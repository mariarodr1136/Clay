import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects, tasks } from "@/server/db/schema";
import { appRouter } from "./root";

// Comments introduce two new authorization boundaries: a task id from
// another org must not resolve, and deleting is gated on authorship rather
// than mere org membership.
describe("comments authorization", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let author: typeof users.$inferSelect;
  let other: typeof users.$inferSelect;
  let taskInA: typeof tasks.$inferSelect;

  const caller = (userId: string, organizationId: string) =>
    appRouter.createCaller({ userId, organizationId });

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Comments Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Comments Org B" }).returning();
    [author] = await db
      .insert(users)
      .values({ id: "test_cmt_author", email: "author@example.com", name: "Author" })
      .returning();
    [other] = await db
      .insert(users)
      .values({ id: "test_cmt_other", email: "other@example.com", name: "Other" })
      .returning();

    const [project] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Comments Project", createdBy: author.id })
      .returning();
    [taskInA] = await db
      .insert(tasks)
      .values({
        organizationId: orgA.id,
        projectId: project.id,
        title: "Commented task",
        createdBy: author.id,
      })
      .returning();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, author.id));
    await db.delete(users).where(eq(users.id, other.id));
  });

  it("hides a task from a caller in a different organization", async () => {
    await expect(
      caller(author.id, orgB.id).comments.taskDetail({ taskId: taskInA.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to attach a comment to another organization's task", async () => {
    await expect(
      caller(author.id, orgB.id).comments.create({ taskId: taskInA.id, body: "leak" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets only the author delete their own comment", async () => {
    const comment = await caller(author.id, orgA.id).comments.create({
      taskId: taskInA.id,
      body: "mine",
    });

    await expect(
      caller(other.id, orgA.id).comments.delete({ commentId: comment.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(author.id, orgA.id).comments.delete({ commentId: comment.id })
    ).resolves.toEqual({ id: comment.id });
  });
});
