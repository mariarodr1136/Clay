import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { projects, tasks } from "@/server/db/schema";

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.projects.findMany({
      where: eq(projects.organizationId, ctx.organizationId),
      orderBy: desc(projects.createdAt),
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.id), eq(projects.organizationId, ctx.organizationId)),
      });
      if (!project) throw new Error("Project not found");
      return project;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await db
        .insert(projects)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description,
          createdBy: ctx.userId,
        })
        .returning();
      return project;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(tasks)
        .where(and(eq(tasks.projectId, input.id), eq(tasks.organizationId, ctx.organizationId)));
      await db
        .delete(projects)
        .where(and(eq(projects.id, input.id), eq(projects.organizationId, ctx.organizationId)));
      return { id: input.id };
    }),
});
