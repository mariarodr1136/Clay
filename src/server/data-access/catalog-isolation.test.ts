import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects, tasks, activityLog, comments } from "@/server/db/schema";
import { queryCatalog, runCatalogQuery, runCatalogQueryForExport } from "./catalog";

// Cross-tenant isolation, checked across the *whole* catalog rather than a
// hand-picked subset.
//
// This is the invariant Postgres row-level security would enforce. RLS is a
// poor fit here — it needs every statement to run inside a transaction
// carrying the org id, and this app streams agent responses for tens of
// seconds, so a request-scoped transaction would pin a database connection
// for the length of an LLM call. So the invariant is enforced by test
// instead, and generated from the catalog itself: adding a query that
// forgets its organization_id filter fails this suite the moment it's
// registered, without anyone remembering to write a case for it.
//
// The detection trick is a marker string seeded into every one of org B's
// records. Any catalog result that serializes with the marker in it has
// leaked, whatever shape that particular query's rows happen to be.
const MARKER = "ZZBLEED";

describe("query catalog isolation (whole catalog)", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let userA: typeof users.$inferSelect;
  let userB: typeof users.$inferSelect;
  let projectB: typeof projects.$inferSelect;

  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Isolation Org A" }).returning();
    [orgB] = await db
      .insert(organizations)
      .values({ name: `${MARKER} Org B` })
      .returning();

    [userA] = await db
      .insert(users)
      .values({ id: "test_iso_user_a", email: "isoa@example.com", name: "Iso User A" })
      .returning();
    [userB] = await db
      .insert(users)
      .values({ id: "test_iso_user_b", email: "isob@example.com", name: `${MARKER} User B` })
      .returning();

    const [projectA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Iso Project A", createdBy: userA.id })
      .returning();
    [projectB] = await db
      .insert(projects)
      .values({ organizationId: orgB.id, name: `${MARKER} Project B`, createdBy: userB.id })
      .returning();

    // Org A gets ordinary data; org B gets the same shapes, every text field
    // carrying the marker, and dates spread so time-windowed queries
    // (velocity, cycle time, aging WIP, upcoming) all have something to find.
    const [taskA] = await db
      .insert(tasks)
      .values({
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "Plain task A",
        status: "in_progress",
        assigneeId: userA.id,
        createdBy: userA.id,
        points: 3,
        dueDate: day(3),
      })
      .returning();

    const [taskB] = await db
      .insert(tasks)
      .values({
        organizationId: orgB.id,
        projectId: projectB.id,
        title: `${MARKER} task B`,
        status: "done",
        assigneeId: userB.id,
        createdBy: userB.id,
        points: 8,
        dueDate: day(-4),
      })
      .returning();

    await db.insert(tasks).values({
      organizationId: orgB.id,
      projectId: projectB.id,
      title: `${MARKER} upcoming B`,
      status: "todo",
      assigneeId: userB.id,
      createdBy: userB.id,
      points: 5,
      dueDate: day(2),
    });

    await db.insert(activityLog).values([
      {
        organizationId: orgA.id,
        actorId: userA.id,
        verb: "task.created",
        entityType: "task",
        entityId: taskA.id,
        metadata: {},
      },
      {
        organizationId: orgB.id,
        actorId: userB.id,
        verb: "task.created",
        entityType: "task",
        entityId: taskB.id,
        metadata: { title: `${MARKER} metadata` },
      },
    ]);

    await db.insert(comments).values({
      organizationId: orgB.id,
      taskId: taskB.id,
      authorId: userB.id,
      body: `${MARKER} comment`,
    });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, userA.id));
    await db.delete(users).where(eq(users.id, userB.id));
  });

  const catalogIds = Object.keys(queryCatalog);

  it("covers every registered catalog query", () => {
    // Guards the guard: if the catalog grows and this file is generated from
    // it, the new query is automatically covered — this just makes the count
    // visible in the test output.
    expect(catalogIds.length).toBeGreaterThan(10);
  });

  it.each(catalogIds)("%s returns nothing belonging to another org", async (queryId) => {
    const rows = await runCatalogQuery(orgA.id, queryId, {});
    expect(JSON.stringify(rows ?? [])).not.toContain(MARKER);
  });

  it.each(catalogIds)(
    "%s ignores another org's projectId instead of honouring it",
    async (queryId) => {
      // The adversarial case: org A explicitly names org B's project. A
      // query that filters on projectId without also filtering on
      // organizationId would happily serve it.
      const entry = queryCatalog[queryId as keyof typeof queryCatalog];
      const accepted = entry.paramsSchema.safeParse({ projectId: projectB.id });
      if (!accepted.success) return;

      const rows = await runCatalogQuery(orgA.id, queryId, { projectId: projectB.id });
      expect(JSON.stringify(rows ?? [])).not.toContain(MARKER);
    }
  );

  it.each(catalogIds)("%s leaks nothing through the export ceiling either", async (queryId) => {
    // Exports re-run the same queries at a much higher row cap through a
    // different entry point; scoping has to hold there too.
    const { rows } = await runCatalogQueryForExport(orgA.id, queryId, {});
    expect(JSON.stringify(rows)).not.toContain(MARKER);
  });

  it("is not passing vacuously — org B can see its own marked data", async () => {
    // Without this, a bug that made every catalog query return nothing would
    // turn this whole suite green.
    const rows = await runCatalogQuery(orgB.id, "tasksList", {});
    expect(JSON.stringify(rows)).toContain(MARKER);
  });
});
