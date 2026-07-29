import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { tasks, taskStatuses, taskPriorities } from "@/server/db/schema";
import { runCatalogQuery } from "@/server/data-access/catalog";
import { runCatalogMutation } from "@/server/data-access/mutations";
import { NotFoundError } from "@/server/errors";

export const tasksRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db.query.tasks.findMany({
        where: and(
          eq(tasks.projectId, input.projectId),
          eq(tasks.organizationId, ctx.organizationId)
        ),
        orderBy: asc(tasks.orderIndex),
      });
    }),

  // Exercises the org-scoped query catalog from real product UI, not just
  // the agent — same choke point, same guarantees, one code path to trust.
  stats: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [statusCounts, overdue] = await Promise.all([
        runCatalogQuery(ctx.organizationId, "tasksByStatusCount", { projectId: input.projectId }, ctx.queryMemo),
        runCatalogQuery(ctx.organizationId, "overdueTasks", { projectId: input.projectId, limit: 5 }, ctx.queryMemo),
      ]);
      return {
        statusCounts: statusCounts as { status: string; count: number }[],
        overdue: overdue as { id: string; title: string; dueDate: string | null }[],
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(300),
        description: z.string().max(4000).optional(),
        priority: z.enum(taskPriorities).default("medium"),
        dueDate: z.string().date().optional(),
        points: z.number().int().min(0).max(100).default(0),
      })
    )
    // Routed through the mutation catalog — the same allow-listed,
    // org-scoped write path that mutation-bound widgets use, so there's one
    // choke point on the write side just as runCatalogQuery is on the read
    // side.
    .mutation(async ({ ctx, input }) => {
      return runCatalogMutation(ctx.organizationId, ctx.userId, "createTask", input);
    }),

  // Through the mutation catalog like the rest: it re-checks that the
  // assignee is a member of this workspace, which only became a meaningful
  // check once workspaces could hold more than one person.
  assign: protectedProcedure
    .input(z.object({ id: z.string().uuid(), assigneeId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      return runCatalogMutation(ctx.organizationId, ctx.userId, "assignTask", {
        taskId: input.id,
        assigneeId: input.assigneeId,
      });
    }),

  setTags: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        // Capped so a runaway client can't turn one row into a document.
        tags: z.array(z.string().min(1).max(24)).max(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await db
        .update(tasks)
        .set({ tags: input.tags, updatedAt: new Date() })
        .where(and(eq(tasks.id, input.id), eq(tasks.organizationId, ctx.organizationId)))
        .returning();
      if (!task) throw new NotFoundError("Task");
      return task;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid(), status: z.enum(taskStatuses) }))
    .mutation(async ({ ctx, input }) => {
      return runCatalogMutation(ctx.organizationId, ctx.userId, "updateTaskStatus", {
        taskId: input.id,
        status: input.status,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(300).optional(),
        description: z.string().max(4000).nullable().optional(),
        priority: z.enum(taskPriorities).optional(),
        dueDate: z.string().date().nullable().optional(),
        points: z.number().int().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [task] = await db
        .update(tasks)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(tasks.id, id), eq(tasks.organizationId, ctx.organizationId)))
        .returning();
      if (!task) throw new NotFoundError("Task");
      return task;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(tasks)
        .where(and(eq(tasks.id, input.id), eq(tasks.organizationId, ctx.organizationId)));
      return { id: input.id };
    }),
});
