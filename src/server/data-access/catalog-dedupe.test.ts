import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects, tasks } from "@/server/db/schema";
import { runCatalogQuery } from "./catalog";

// runCatalogQuery memoizes through React's cache(), which is *request*
// scoped. This suite pins the two properties that memoization must not
// break, because getting either wrong would be worse than the round trips it
// saves:
//
//   1. The organization id is part of the key, so one org's rows can never
//      be served to another out of a shared memo.
//   2. It does not outlive a write. A cache that survived across requests
//      would serve a task list missing the task the user just created.
describe("catalog query memoization", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;
  let projectA: typeof projects.$inferSelect;

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Dedupe Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Dedupe Org B" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_dedupe_user", email: "d@example.com", name: "Dedupe User" })
      .returning();

    [projectA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Dedupe Project", createdBy: user.id })
      .returning();

    await db.insert(tasks).values({
      organizationId: orgA.id,
      projectId: projectA.id,
      title: "First task",
      createdBy: user.id,
    });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, user.id));
  });

  it("keeps organizations apart even for an identical query and params", async () => {
    const a = (await runCatalogQuery(orgA.id, "tasksList", {})) as { title: string }[];
    const b = (await runCatalogQuery(orgB.id, "tasksList", {})) as { title: string }[];

    expect(a.map((t) => t.title)).toContain("First task");
    expect(b).toEqual([]);
  });

  it("reflects a write made after an earlier read", async () => {
    const before = (await runCatalogQuery(orgA.id, "tasksList", {})) as unknown[];

    await db.insert(tasks).values({
      organizationId: orgA.id,
      projectId: projectA.id,
      title: "Second task",
      createdBy: user.id,
    });

    const after = (await runCatalogQuery(orgA.id, "tasksList", {})) as { title: string }[];
    expect(after.length).toBe(before.length + 1);
    expect(after.map((t) => t.title)).toContain("Second task");
  });

  it("treats equivalent params as the same query and different ones as different", async () => {
    // {} and an explicit default must resolve to one key; a real filter must
    // not collide with the unfiltered query.
    const implicit = (await runCatalogQuery(orgA.id, "tasksList", {})) as unknown[];
    const explicit = (await runCatalogQuery(orgA.id, "tasksList", { limit: 50 })) as unknown[];
    expect(explicit.length).toBe(implicit.length);

    const filtered = (await runCatalogQuery(orgA.id, "tasksList", {
      status: "done",
    })) as unknown[];
    expect(filtered.length).toBe(0);
  });
});
