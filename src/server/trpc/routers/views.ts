import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { views, viewVersions } from "@/server/db/schema";
import { viewSchema } from "@/lib/dsl/schema";
import { runCatalogQuery } from "@/server/data-access/catalog";
import { createView, patchView } from "@/server/db/create-view";
import type { ViewInput } from "@/lib/dsl/schema";

export const viewsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.views.findMany({
      where: eq(views.organizationId, ctx.organizationId),
      orderBy: desc(views.createdAt),
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const view = await db.query.views.findFirst({
        where: and(eq(views.id, input.id), eq(views.organizationId, ctx.organizationId)),
      });
      if (!view || !view.currentVersionId) throw new Error("View not found");

      const version = await db.query.viewVersions.findFirst({
        where: eq(viewVersions.id, view.currentVersionId),
      });
      if (!version) throw new Error("View has no current version");

      return { view, schema: version.schemaJson };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(200), schema: viewSchema }))
    .mutation(async ({ ctx, input }) => {
      return createView({
        organizationId: ctx.organizationId,
        ownerId: ctx.userId,
        name: input.name,
        schema: input.schema,
        createdBy: "user",
      });
    }),

  // The same choke point the agent's run_query tool calls — queryId/params
  // are validated against the catalog's own schemas, and organizationId
  // comes only from the session, never from the client.
  runQuery: protectedProcedure
    .input(z.object({ queryId: z.string(), params: z.record(z.string(), z.unknown()).default({}) }))
    .query(async ({ ctx, input }) => {
      return runCatalogQuery(ctx.organizationId, input.queryId, input.params);
    }),

  listVersions: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const view = await db.query.views.findFirst({
        where: and(eq(views.id, input.viewId), eq(views.organizationId, ctx.organizationId)),
      });
      if (!view) throw new Error("View not found");

      return db.query.viewVersions.findMany({
        where: eq(viewVersions.viewId, input.viewId),
        orderBy: desc(viewVersions.createdAt),
      });
    }),

  revert: protectedProcedure
    .input(z.object({ viewId: z.string().uuid(), versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Org ownership is checked before touching the target version's
      // content at all, not just at the eventual patchView call.
      const view = await db.query.views.findFirst({
        where: and(eq(views.id, input.viewId), eq(views.organizationId, ctx.organizationId)),
      });
      if (!view) throw new Error("View not found");

      const target = await db.query.viewVersions.findFirst({
        where: and(eq(viewVersions.id, input.versionId), eq(viewVersions.viewId, input.viewId)),
      });
      if (!target) throw new Error("Version not found");

      return patchView({
        organizationId: ctx.organizationId,
        viewId: input.viewId,
        schema: target.schemaJson as ViewInput,
        createdBy: "user",
        promptText: `Reverted to an earlier version`,
      });
    }),

  // The only sanctioned way a view's scope changes — always an explicit,
  // separately-invoked user action, never a side effect of create/patch
  // (see propose-view.ts and patchView).
  publish: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(views)
        .set({ scope: "org", updatedAt: new Date() })
        .where(and(eq(views.id, input.viewId), eq(views.organizationId, ctx.organizationId)))
        .returning();
      if (!updated) throw new Error("View not found");
      return updated;
    }),

  // Org-wide audit trail: who/what/when for every view proposal, whether
  // from the agent or a manual edit — view_versions already captures this,
  // this just surfaces it across all of an org's views in one place.
  listActivity: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      return db
        .select({
          id: viewVersions.id,
          viewId: viewVersions.viewId,
          viewName: views.name,
          createdBy: viewVersions.createdBy,
          promptText: viewVersions.promptText,
          createdAt: viewVersions.createdAt,
        })
        .from(viewVersions)
        .innerJoin(views, eq(views.id, viewVersions.viewId))
        .where(eq(views.organizationId, ctx.organizationId))
        .orderBy(desc(viewVersions.createdAt))
        .limit(input.limit);
    }),

  unpublish: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(views)
        .set({ scope: "personal", updatedAt: new Date() })
        .where(and(eq(views.id, input.viewId), eq(views.organizationId, ctx.organizationId)))
        .returning();
      if (!updated) throw new Error("View not found");
      return updated;
    }),
});
