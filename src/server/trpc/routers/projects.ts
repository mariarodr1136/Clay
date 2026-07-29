import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { router, protectedProcedure, ownerProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { projects, tasks, users, projectFolders } from "@/server/db/schema";
import { seedSampleData, seedSampleHistory } from "@/server/db/seed-sample-data";
import { seedSampleViews } from "@/server/db/seed-sample-views";
import { ConflictError, NotFoundError } from "@/server/errors";

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
        folderId: projects.folderId,
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
  seedSample: ownerProcedure.mutation(async ({ ctx }) => {
    const existing = await db.query.projects.findFirst({
      where: eq(projects.organizationId, ctx.organizationId),
    });
    if (existing) {
      throw new ConflictError(
        "This workspace already has projects — sample data is only for empty workspaces."
      );
    }
    const project = await seedSampleData(ctx.organizationId, ctx.userId);
    await seedSampleViews(ctx.organizationId, ctx.userId, project.id);
    await seedSampleHistory(ctx.organizationId, ctx.userId, {
      publish: ["Delivery Overview"],
    });
    return project;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.id), eq(projects.organizationId, ctx.organizationId)),
      });
      if (!project) throw new NotFoundError("Project");

      // Everything the header shows, in one round trip. The people are
      // derived from who actually holds work rather than stored, so the list
      // stays true without anyone maintaining it.
      const [lead] = project.leadId
        ? await db
            .select({ id: users.id, name: users.name, imageUrl: users.imageUrl })
            .from(users)
            .where(eq(users.id, project.leadId))
        : [];

      const members = await db
        .selectDistinct({ id: users.id, name: users.name, imageUrl: users.imageUrl })
        .from(tasks)
        .innerJoin(users, eq(users.id, tasks.assigneeId))
        .where(
          and(eq(tasks.projectId, project.id), eq(tasks.organizationId, ctx.organizationId))
        );

      const [totals] = await db
        .select({
          total: sql<number>`count(*)::int`,
          done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
          openPoints: sql<number>`coalesce(sum(${tasks.points}) filter (where ${tasks.status} != 'done'), 0)::int`,
          overdue: sql<number>`count(*) filter (where ${tasks.status} != 'done' and ${tasks.dueDate} < current_date)::int`,
        })
        .from(tasks)
        .where(
          and(eq(tasks.projectId, project.id), eq(tasks.organizationId, ctx.organizationId))
        );

      return {
        ...project,
        lead: lead ?? null,
        members,
        stats: {
          ...totals,
          percentComplete:
            totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100),
        },
      };
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

  // Deleting a project takes every teammate's tasks with it, so it is
  // owner-only in a shared workspace.
  // Moving a project between folders, or out of one entirely. Null is a
  // legitimate destination, not a missing value.
  move: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        folderId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.folderId) {
        // A folder id from another workspace must not become reachable by
        // routing a project into it.
        const folder = await db.query.projectFolders.findFirst({
          where: and(
            eq(projectFolders.id, input.folderId),
            eq(projectFolders.organizationId, ctx.organizationId)
          ),
        });
        if (!folder) throw new NotFoundError("Folder");
      }

      const [updated] = await db
        .update(projects)
        .set({ folderId: input.folderId, updatedAt: new Date() })
        .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, ctx.organizationId)))
        .returning();
      if (!updated) throw new NotFoundError("Project");
      return updated;
    }),

  delete: ownerProcedure
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
