import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { router, protectedProcedure, ownerProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { projectFolders, projects } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";

// Folders never own their projects — they label them. Deleting one leaves
// the work alone and simply ungroups it, which is why none of this is
// destructive enough to need a confirmation step.
export const foldersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: projectFolders.id,
        name: projectFolders.name,
        colorVar: projectFolders.colorVar,
        orderIndex: projectFolders.orderIndex,
        projectCount: sql<number>`count(${projects.id})::int`,
      })
      .from(projectFolders)
      .leftJoin(projects, eq(projects.folderId, projectFolders.id))
      .where(eq(projectFolders.organizationId, ctx.organizationId))
      .groupBy(projectFolders.id)
      .orderBy(asc(projectFolders.orderIndex), asc(projectFolders.name));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        colorVar: z.string().max(40).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // New folders land at the end rather than the top: an existing order
      // is someone's arrangement, and inserting into it is a surprise.
      const [{ next }] = await db
        .select({ next: sql<number>`coalesce(max(${projectFolders.orderIndex}), -1) + 1` })
        .from(projectFolders)
        .where(eq(projectFolders.organizationId, ctx.organizationId));

      const [folder] = await db
        .insert(projectFolders)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          colorVar: input.colorVar,
          orderIndex: Number(next),
        })
        .returning();
      return folder;
    }),

  rename: protectedProcedure
    .input(z.object({ folderId: z.string().uuid(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(projectFolders)
        .set({ name: input.name })
        .where(
          and(
            eq(projectFolders.id, input.folderId),
            eq(projectFolders.organizationId, ctx.organizationId)
          )
        )
        .returning();
      if (!updated) throw new NotFoundError("Folder");
      return updated;
    }),

  // Owner-only, because it changes how the whole workspace is arranged for
  // everyone in it — even though nothing is lost.
  delete: ownerProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(projectFolders)
        .where(
          and(
            eq(projectFolders.id, input.folderId),
            eq(projectFolders.organizationId, ctx.organizationId)
          )
        )
        .returning();
      if (!deleted) throw new NotFoundError("Folder");
      // projects.folder_id is ON DELETE SET NULL, so the projects survive
      // and simply become ungrouped.
      return { id: deleted.id };
    }),

  reorder: protectedProcedure
    .input(z.object({ folderIds: z.array(z.string().uuid()).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await db.transaction(async (tx) => {
        for (const [index, folderId] of input.folderIds.entries()) {
          await tx
            .update(projectFolders)
            .set({ orderIndex: index })
            .where(
              and(
                eq(projectFolders.id, folderId),
                eq(projectFolders.organizationId, ctx.organizationId)
              )
            );
        }
      });
      return { ordered: input.folderIds.length };
    }),
});
