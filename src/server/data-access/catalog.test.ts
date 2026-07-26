import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects, tasks } from "@/server/db/schema";
import { runCatalogQuery } from "./catalog";

// Proves the query catalog's org-scoping invariant: no combination of
// catalog params can make an org A query return org B's data, even when
// org A explicitly passes org B's own projectId as a filter.
describe("query catalog cross-org isolation", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let userA: typeof users.$inferSelect;
  let userB: typeof users.$inferSelect;
  let projectA: typeof projects.$inferSelect;
  let projectB: typeof projects.$inferSelect;

  const daysFromNow = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    [orgA] = await db
      .insert(organizations)
      .values({ name: "Catalog Test Org A" })
      .returning();
    [orgB] = await db
      .insert(organizations)
      .values({ name: "Catalog Test Org B" })
      .returning();

    [userA] = await db
      .insert(users)
      .values({ id: "test_user_a", email: "a@example.com", name: "User A" })
      .returning();
    [userB] = await db
      .insert(users)
      .values({ id: "test_user_b", email: "b@example.com", name: "User B" })
      .returning();

    [projectA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Project A", createdBy: userA.id })
      .returning();
    [projectB] = await db
      .insert(projects)
      .values({ organizationId: orgB.id, name: "Project B", createdBy: userB.id })
      .returning();

    await db.insert(tasks).values([
      {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "A: overdue todo",
        status: "todo",
        priority: "high",
        dueDate: daysFromNow(-3),
        assigneeId: userA.id,
        createdBy: userA.id,
        points: 3,
      },
      {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "A: done",
        status: "done",
        priority: "medium",
        assigneeId: userA.id,
        createdBy: userA.id,
        points: 5,
      },
      {
        organizationId: orgB.id,
        projectId: projectB.id,
        title: "B: overdue todo",
        status: "todo",
        priority: "urgent",
        dueDate: daysFromNow(-5),
        assigneeId: userB.id,
        createdBy: userB.id,
      },
      {
        organizationId: orgB.id,
        projectId: projectB.id,
        title: "B: done",
        status: "done",
        priority: "low",
        assigneeId: userB.id,
        createdBy: userB.id,
        points: 8,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, userA.id));
    await db.delete(users).where(eq(users.id, userB.id));
  });

  it("tasksList never returns another org's rows", async () => {
    const result = (await runCatalogQuery(orgA.id, "tasksList", {})) as { title: string }[];
    const titles = result.map((t) => t.title);
    expect(titles).toContain("A: overdue todo");
    expect(titles).toContain("A: done");
    expect(titles.some((t) => t.startsWith("B:"))).toBe(false);
  });

  it("tasksList scoped to org A ignores org B's projectId and returns nothing", async () => {
    const result = (await runCatalogQuery(orgA.id, "tasksList", {
      projectId: projectB.id,
    })) as unknown[];
    expect(result).toEqual([]);
  });

  it("overdueTasks scoped to org A ignores org B's projectId and returns nothing", async () => {
    const result = (await runCatalogQuery(orgA.id, "overdueTasks", {
      projectId: projectB.id,
    })) as unknown[];
    expect(result).toEqual([]);
  });

  it("overdueTasks only returns org A's own overdue task", async () => {
    const result = (await runCatalogQuery(orgA.id, "overdueTasks", {})) as { title: string }[];
    expect(result.map((t) => t.title)).toEqual(["A: overdue todo"]);
  });

  it("tasksByStatusCount totals match only org A's tasks", async () => {
    const result = (await runCatalogQuery(orgA.id, "tasksByStatusCount", {})) as {
      status: string;
      count: number;
    }[];
    const total = result.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(2);
  });

  it("tasksByAssignee only reflects org A's assignee", async () => {
    const result = (await runCatalogQuery(orgA.id, "tasksByAssignee", {})) as {
      assigneeId: string | null;
      count: number;
    }[];
    expect(result).toEqual([{ assigneeId: userA.id, count: 2 }]);
  });

  it("velocityByWeek sums only org A's completed points", async () => {
    const result = (await runCatalogQuery(orgA.id, "velocityByWeek", {})) as {
      week: string;
      points: number;
      tasks: number;
    }[];
    expect(result.reduce((s, r) => s + r.points, 0)).toBe(5);
    expect(result.reduce((s, r) => s + r.tasks, 0)).toBe(1);
  });

  it("pointsByProject reflects only org A's open points", async () => {
    const result = (await runCatalogQuery(orgA.id, "pointsByProject", {})) as {
      project: string;
      points: number;
    }[];
    expect(result).toEqual([{ project: "Project A", points: 3 }]);
  });

  it("agingWip returns every bucket zero-filled and only counts org A's open tasks", async () => {
    const result = (await runCatalogQuery(orgA.id, "agingWip", {})) as {
      bucket: string;
      count: number;
    }[];
    expect(result.map((r) => r.bucket)).toEqual([
      "0-3 days",
      "4-7 days",
      "8-14 days",
      "15-30 days",
      "30+ days",
    ]);
    // Org A has exactly one open task, created just now.
    expect(result.reduce((s, r) => s + r.count, 0)).toBe(1);
    expect(result[0].count).toBe(1);
  });

  it("agingWip scoped to org B's projectId from org A returns all-zero buckets", async () => {
    const result = (await runCatalogQuery(orgA.id, "agingWip", { projectId: projectB.id })) as {
      count: number;
    }[];
    expect(result.reduce((s, r) => s + r.count, 0)).toBe(0);
  });

  it("createdVsCompleted merges both series per day for org A only", async () => {
    const result = (await runCatalogQuery(orgA.id, "createdVsCompleted", { days: 7 })) as {
      day: string;
      created: number;
      completed: number;
    }[];
    expect(result.length).toBe(1);
    expect(result[0].created).toBe(2);
    expect(result[0].completed).toBe(1);
  });

  it("cycleTimeByWeek only reflects org A's completed tasks", async () => {
    const result = (await runCatalogQuery(orgA.id, "cycleTimeByWeek", {})) as {
      week: string;
      avgDays: number;
      tasks: number;
    }[];
    expect(result.reduce((s, r) => s + r.tasks, 0)).toBe(1);
  });

  it("rejects an unknown query id", async () => {
    await expect(runCatalogQuery(orgA.id, "not_a_real_query", {})).rejects.toThrow(
      /Unknown query catalog id/
    );
  });

  it("rejects params that don't match the schema", async () => {
    await expect(
      runCatalogQuery(orgA.id, "tasksList", { status: "not_a_status" })
    ).rejects.toThrow();
  });
});
