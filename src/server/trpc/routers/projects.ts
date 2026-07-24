import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { projects, tasks } from "@/server/db/schema";
import { seedDemoData } from "@/server/db/seed-demo-data";
import { seedDemoViews } from "@/server/db/seed-demo-views";

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.projects.findMany({
      where: eq(projects.organizationId, ctx.organizationId),
      orderBy: desc(projects.createdAt),
    });
  }),

  // Projects with the task roll-ups the dashboard cards render (progress
  // bar, overdue badge) — one grouped query instead of N stats calls.
  listWithStats: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        total: sql<number>`count(${tasks.id})::int`,
        done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
        inFlight: sql<number>`count(*) filter (where ${tasks.status} in ('in_progress', 'in_review'))::int`,
        overdue: sql<number>`count(*) filter (where ${tasks.status} != 'done' and ${tasks.dueDate} < current_date)::int`,
      })
      .from(projects)
      .leftJoin(tasks, eq(tasks.projectId, projects.id))
      .where(eq(projects.organizationId, ctx.organizationId))
      .groupBy(projects.id)
      .orderBy(desc(projects.createdAt));
  }),

  // Explicit opt-in replacement for the old always-on sign-up seeding: fills
  // an empty workspace with the sample project, tasks, and generated views
  // so a new user can explore a working workspace before adding real data.
  seedSample: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await db.query.projects.findFirst({
      where: eq(projects.organizationId, ctx.organizationId),
    });
    if (existing) {
      throw new Error("This workspace already has projects — sample data is only for empty workspaces.");
    }
    const project = await seedDemoData(ctx.organizationId, ctx.userId);
    await seedDemoViews(ctx.organizationId, ctx.userId, project.id);
    return project;
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
