import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, memberships, projects, tasks } from "@/server/db/schema";
import { runCatalogMutation } from "./mutations";

// The mutation catalog's security invariants, mirroring catalog.test.ts on
// the write side: no combination of params lets org A write into org B, and
// an assignee outside the workspace is rejected rather than attached.
describe("mutation catalog cross-org isolation", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let userA: typeof users.$inferSelect;
  let userB: typeof users.$inferSelect;
  let projectA: typeof projects.$inferSelect;
  let projectB: typeof projects.$inferSelect;
  let taskB: typeof tasks.$inferSelect;

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Mutation Test Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Mutation Test Org B" }).returning();

    [userA] = await db
      .insert(users)
      .values({ id: "test_mut_user_a", email: "muta@example.com", name: "Mut User A" })
      .returning();
    [userB] = await db
      .insert(users)
      .values({ id: "test_mut_user_b", email: "mutb@example.com", name: "Mut User B" })
      .returning();

    await db.insert(memberships).values([
      { organizationId: orgA.id, userId: userA.id, role: "owner" },
      { organizationId: orgB.id, userId: userB.id, role: "owner" },
    ]);

    [projectA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Mut Project A", createdBy: userA.id })
      .returning();
    [projectB] = await db
      .insert(projects)
      .values({ organizationId: orgB.id, name: "Mut Project B", createdBy: userB.id })
      .returning();

    [taskB] = await db
      .insert(tasks)
      .values({
        organizationId: orgB.id,
        projectId: projectB.id,
        title: "B's task",
        createdBy: userB.id,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, userA.id));
    await db.delete(users).where(eq(users.id, userB.id));
  });

  it("rejects an unknown mutation id", async () => {
    await expect(runCatalogMutation(orgA.id, userA.id, "dropAllTasks", {})).rejects.toThrow(
      /Unknown mutation catalog id/
    );
  });

  it("rejects params that don't match the mutation's schema", async () => {
    await expect(
      runCatalogMutation(orgA.id, userA.id, "updateTaskStatus", {
        taskId: taskB.id,
        status: "not_a_status",
      })
    ).rejects.toThrow();
  });

  it("createTask cannot attach a task to another org's project", async () => {
    await expect(
      runCatalogMutation(orgA.id, userA.id, "createTask", {
        projectId: projectB.id,
        title: "Sneaky task",
      })
    ).rejects.toThrow("Project not found");
  });

  it("updateTaskStatus cannot touch another org's task, even with its real id", async () => {
    await expect(
      runCatalogMutation(orgA.id, userA.id, "updateTaskStatus", {
        taskId: taskB.id,
        status: "done",
      })
    ).rejects.toThrow("Task not found");

    const untouched = await db.query.tasks.findFirst({ where: eq(tasks.id, taskB.id) });
    expect(untouched?.status).toBe("todo");
  });

  it("setTaskDueDate cannot touch another org's task", async () => {
    await expect(
      runCatalogMutation(orgA.id, userA.id, "setTaskDueDate", {
        taskId: taskB.id,
        dueDate: "2030-01-01",
      })
    ).rejects.toThrow("Task not found");
  });

  it("assignTask rejects an assignee who is not a member of the caller's org", async () => {
    const task = (await runCatalogMutation(orgA.id, userA.id, "createTask", {
      projectId: projectA.id,
      title: "A's task",
    })) as typeof tasks.$inferSelect;

    await expect(
      runCatalogMutation(orgA.id, userA.id, "assignTask", {
        taskId: task.id,
        assigneeId: userB.id,
      })
    ).rejects.toThrow("not a member");
  });

  it("assignTask assigns and clears within the caller's own org", async () => {
    const task = (await runCatalogMutation(orgA.id, userA.id, "createTask", {
      projectId: projectA.id,
      title: "Assignable task",
    })) as typeof tasks.$inferSelect;

    const assigned = (await runCatalogMutation(orgA.id, userA.id, "assignTask", {
      taskId: task.id,
      assigneeId: userA.id,
    })) as typeof tasks.$inferSelect;
    expect(assigned.assigneeId).toBe(userA.id);

    const cleared = (await runCatalogMutation(orgA.id, userA.id, "assignTask", {
      taskId: task.id,
      assigneeId: null,
    })) as typeof tasks.$inferSelect;
    expect(cleared.assigneeId).toBeNull();
  });

  it("createTask in the caller's own org succeeds and stays org-scoped", async () => {
    const task = (await runCatalogMutation(orgA.id, userA.id, "createTask", {
      projectId: projectA.id,
      title: "Legit task",
      points: 5,
    })) as typeof tasks.$inferSelect;

    expect(task.organizationId).toBe(orgA.id);
    expect(task.points).toBe(5);
  });
});
