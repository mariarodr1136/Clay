import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { tasks, activityLog, taskStatuses, taskPriorities } from "@/server/db/schema";

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

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(300),
        description: z.string().max(4000).optional(),
        priority: z.enum(taskPriorities).default("medium"),
        dueDate: z.string().date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await db
        .insert(tasks)
        .values({
          organizationId: ctx.organizationId,
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
          createdBy: ctx.userId,
        })
        .returning();

      await db.insert(activityLog).values({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        verb: "task.created",
        entityType: "task",
        entityId: task.id,
        metadata: { title: task.title },
      });

      return task;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid(), status: z.enum(taskStatuses) }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await db
        .update(tasks)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(tasks.id, input.id), eq(tasks.organizationId, ctx.organizationId)))
        .returning();
      if (!task) throw new Error("Task not found");

      await db.insert(activityLog).values({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        verb: "task.status_changed",
        entityType: "task",
        entityId: task.id,
        metadata: { status: input.status },
      });

      return task;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(300).optional(),
        description: z.string().max(4000).nullable().optional(),
        priority: z.enum(taskPriorities).optional(),
        dueDate: z.string().date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [task] = await db
        .update(tasks)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(tasks.id, id), eq(tasks.organizationId, ctx.organizationId)))
        .returning();
      if (!task) throw new Error("Task not found");
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
