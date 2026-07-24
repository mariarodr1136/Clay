import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { views, viewVersions } from "@/server/db/schema";
import { viewSchema } from "@/lib/dsl/schema";
import { runCatalogQuery } from "@/server/data-access/catalog";
import { createView, patchView } from "@/server/db/create-view";
import type { ViewInput } from "@/lib/dsl/schema";

export const viewsRouter = router({
  // Views plus the metadata their gallery cards render: the prompt behind
  // the current version, per-type widget counts, and how many versions exist.
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.views.findMany({
      where: eq(views.organizationId, ctx.organizationId),
      orderBy: desc(views.updatedAt),
    });

    const currentIds = rows.flatMap((v) => (v.currentVersionId ? [v.currentVersionId] : []));
    const currentVersions = currentIds.length
      ? await db.query.viewVersions.findMany({ where: inArray(viewVersions.id, currentIds) })
      : [];
    const versionsById = new Map(currentVersions.map((v) => [v.id, v]));

    const counts = rows.length
      ? await db
          .select({ viewId: viewVersions.viewId, count: sql<number>`count(*)::int` })
          .from(viewVersions)
          .where(
            inArray(
              viewVersions.viewId,
              rows.map((v) => v.id)
            )
          )
          .groupBy(viewVersions.viewId)
      : [];
    const versionCounts = new Map(counts.map((c) => [c.viewId, c.count]));

    return rows.map((view) => {
      const version = view.currentVersionId ? versionsById.get(view.currentVersionId) : undefined;
      const schema = version?.schemaJson as { widgets?: { type?: string }[] } | undefined;
      const widgetCounts: Record<string, number> = {};
      for (const w of schema?.widgets ?? []) {
        if (typeof w?.type === "string") widgetCounts[w.type] = (widgetCounts[w.type] ?? 0) + 1;
      }
      return {
        ...view,
        promptText: version?.promptText ?? null,
        widgetCounts,
        versionCount: versionCounts.get(view.id) ?? 1,
      };
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

      return {
        view,
        schema: version.schemaJson,
        version: {
          promptText: version.promptText,
          createdBy: version.createdBy,
          createdAt: version.createdAt,
        },
      };
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
          // First version of a view has no parent — lets the UI distinguish
          // "created" from "refined" without another query.
          parentVersionId: viewVersions.parentVersionId,
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
