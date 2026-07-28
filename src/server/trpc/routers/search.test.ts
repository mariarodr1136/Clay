import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects, tasks, views } from "@/server/db/schema";
import { createView } from "@/server/db/create-view";
import { appRouter } from "./root";
import type { ViewInput } from "@/lib/dsl/schema";

const schema: ViewInput = {
  name: "Searchable view",
  scope: "personal",
  layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
  widgets: [{ id: "w1", type: "text", config: { content: "hi" } }],
};

describe("command palette search", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;
  let trashedViewId: string;

  const caller = (organizationId: string) =>
    appRouter.createCaller({ userId: user.id, organizationId, role: "owner" as const });

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Search Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Search Org B" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_search_user", email: "s@example.com", name: "Search User" })
      .returning();

    const [projectA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Apollo migration", createdBy: user.id })
      .returning();
    await db
      .insert(projects)
      .values({ organizationId: orgB.id, name: "Apollo secret", createdBy: user.id });

    await db.insert(tasks).values([
      {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "Ship 50% of the rollout",
        createdBy: user.id,
      },
      {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "Unrelated chore",
        createdBy: user.id,
      },
    ]);

    const { view } = await createView({
      organizationId: orgA.id,
      ownerId: user.id,
      name: "Apollo dashboard",
      schema,
      createdBy: "user",
    });

    const { view: trashed } = await createView({
      organizationId: orgA.id,
      ownerId: user.id,
      name: "Apollo archived",
      schema,
      createdBy: "user",
    });
    trashedViewId = trashed.id;
    await db.update(views).set({ deletedAt: new Date() }).where(eq(views.id, trashed.id));
    expect(view.id).toBeTruthy();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, user.id));
  });

  it("finds projects, views, and tasks in the caller's workspace", async () => {
    const result = await caller(orgA.id).search.all({ q: "Apollo" });
    expect(result.projects.map((p) => p.name)).toEqual(["Apollo migration"]);
    expect(result.views.map((v) => v.name)).toContain("Apollo dashboard");
  });

  it("never returns another organization's records", async () => {
    const result = await caller(orgB.id).search.all({ q: "Apollo" });
    expect(result.projects.map((p) => p.name)).toEqual(["Apollo secret"]);
    expect(result.views).toHaveLength(0);
    expect(result.tasks).toHaveLength(0);
  });

  it("excludes trashed views", async () => {
    const result = await caller(orgA.id).search.all({ q: "Apollo archived" });
    expect(result.views.map((v) => v.id)).not.toContain(trashedViewId);
  });

  it("treats % as a literal character, not a wildcard", async () => {
    // Unescaped, "50%" would become LIKE '%50%%' and match far more than
    // the user asked for.
    const literal = await caller(orgA.id).search.all({ q: "50%" });
    expect(literal.tasks.map((t) => t.title)).toEqual(["Ship 50% of the rollout"]);

    // A bare "%" finds only the task that literally contains one.
    // Unescaped it would become LIKE '%%%' and match every task in the org.
    const bare = await caller(orgA.id).search.all({ q: "%" });
    expect(bare.tasks.map((t) => t.title)).toEqual(["Ship 50% of the rollout"]);
  });
});
