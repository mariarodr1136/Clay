import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { views, viewVersions, viewTemplates } from "@/server/db/schema";
import { layoutItemSchema, viewSchema } from "@/lib/dsl/schema";
import { runCatalogQuery } from "@/server/data-access/catalog";
import { runCatalogMutation } from "@/server/data-access/mutations";
import { createView, patchView } from "@/server/db/create-view";
import { activeView, activeViewsInOrg } from "@/server/db/view-access";
import { NotFoundError } from "@/server/errors";
import type { ViewInput } from "@/lib/dsl/schema";

export const viewsRouter = router({
  // Views plus the metadata their gallery cards render: the prompt behind
  // the current version, per-type widget counts, and how many versions exist.
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.views.findMany({
      where: activeViewsInOrg(ctx.organizationId),
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
        where: activeView(input.id, ctx.organizationId),
      });
      if (!view || !view.currentVersionId) throw new NotFoundError("View");

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

  // The write-side twin of runQuery: mutation-bound widgets (task forms,
  // status dropdowns on table rows) land here. mutationId/params are
  // validated against the mutation catalog's own schemas; organizationId and
  // the acting user come only from the session. The agent never reaches this
  // — it has no tool for it — a widget it configured still executes under
  // the clicking user's authority, not the agent's.
  runMutation: protectedProcedure
    .input(z.object({ mutationId: z.string(), params: z.record(z.string(), z.unknown()).default({}) }))
    .mutation(async ({ ctx, input }) => {
      return runCatalogMutation(ctx.organizationId, ctx.userId, input.mutationId, input.params);
    }),

  listVersions: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const view = await db.query.views.findFirst({
        where: activeView(input.viewId, ctx.organizationId),
      });
      if (!view) throw new NotFoundError("View");

      return db.query.viewVersions.findMany({
        where: eq(viewVersions.viewId, input.viewId),
        orderBy: desc(viewVersions.createdAt),
      });
    }),

  // Manual drag/resize edits from the layout editor. Only geometry can
  // change here — widgets and bindings are carried over from the current
  // version verbatim — and the result is a normal new version row, so a
  // hand-tuned layout sits in the same history as agent edits and reverts.
  saveLayout: protectedProcedure
    .input(
      z.object({
        viewId: z.string().uuid(),
        layout: z.object({ widgets: z.array(layoutItemSchema).max(24) }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const view = await db.query.views.findFirst({
        where: activeView(input.viewId, ctx.organizationId),
      });
      if (!view?.currentVersionId) throw new NotFoundError("View");

      const current = await db.query.viewVersions.findFirst({
        where: eq(viewVersions.id, view.currentVersionId),
      });
      if (!current) throw new Error("View has no current version");

      // Re-validated through the full view schema so a layout that orphans
      // or invents a widget id is rejected exactly like a bad agent proposal.
      const schema = viewSchema.parse({
        ...(current.schemaJson as Record<string, unknown>),
        layout: input.layout,
      });

      return patchView({
        organizationId: ctx.organizationId,
        viewId: input.viewId,
        schema,
        createdBy: "user",
        promptText: "Manually adjusted the layout",
      });
    }),

  revert: protectedProcedure
    .input(z.object({ viewId: z.string().uuid(), versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Org ownership is checked before touching the target version's
      // content at all, not just at the eventual patchView call.
      const view = await db.query.views.findFirst({
        where: activeView(input.viewId, ctx.organizationId),
      });
      if (!view) throw new NotFoundError("View");

      const target = await db.query.viewVersions.findFirst({
        where: and(eq(viewVersions.id, input.versionId), eq(viewVersions.viewId, input.viewId)),
      });
      if (!target) throw new NotFoundError("Version");

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
        .where(activeView(input.viewId, ctx.organizationId))
        .returning();
      if (!updated) throw new NotFoundError("View");
      return updated;
    }),

  rename: protectedProcedure
    .input(z.object({ viewId: z.string().uuid(), name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      // A rename is metadata, not content: it deliberately does not mint a
      // new version, so the history panel keeps showing real schema changes
      // rather than filling up with title edits.
      const [updated] = await db
        .update(views)
        .set({ name: input.name, updatedAt: new Date() })
        .where(activeView(input.viewId, ctx.organizationId))
        .returning();
      if (!updated) throw new NotFoundError("View");
      return updated;
    }),

  // Soft delete. Versions, templates stamped from this view, and the audit
  // trail all survive — the view just leaves the gallery. Any live share
  // link stops resolving immediately (see activeView), which is the
  // behaviour someone reaching for "delete" actually wants.
  delete: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(views)
        .set({ deletedAt: new Date() })
        .where(activeView(input.viewId, ctx.organizationId))
        .returning();
      if (!updated) throw new NotFoundError("View");
      return { id: updated.id };
    }),

  restore: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(views)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(views.id, input.viewId),
            eq(views.organizationId, ctx.organizationId),
            isNotNull(views.deletedAt)
          )
        )
        .returning();
      if (!updated) throw new NotFoundError("View");
      return updated;
    }),

  listTrash: protectedProcedure.query(async ({ ctx }) => {
    return db.query.views.findMany({
      where: and(eq(views.organizationId, ctx.organizationId), isNotNull(views.deletedAt)),
      orderBy: desc(views.deletedAt),
    });
  }),

  // Irreversible, and deliberately separate from `delete`: this is the only
  // path that destroys version history, so it can only be reached from the
  // trash, on a view that was already soft-deleted.
  purge: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const view = await db.query.views.findFirst({
        where: and(
          eq(views.id, input.viewId),
          eq(views.organizationId, ctx.organizationId),
          isNotNull(views.deletedAt)
        ),
      });
      if (!view) throw new NotFoundError("View");

      // views.current_version_id references view_versions, so the pointer
      // has to be dropped before the versions it points at.
      await db.transaction(async (tx) => {
        await tx.update(views).set({ currentVersionId: null }).where(eq(views.id, input.viewId));
        await tx.delete(viewVersions).where(eq(viewVersions.viewId, input.viewId));
        await tx.delete(views).where(eq(views.id, input.viewId));
      });
      return { id: input.viewId };
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
        .where(activeViewsInOrg(ctx.organizationId))
        .orderBy(desc(viewVersions.createdAt))
        .limit(input.limit);
    }),

  unpublish: protectedProcedure
    .input(z.object({ viewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(views)
        .set({ scope: "personal", updatedAt: new Date() })
        .where(activeView(input.viewId, ctx.organizationId))
        .returning();
      if (!updated) throw new NotFoundError("View");
      return updated;
    }),

  // Public read-only share links. The token is the whole capability: 192
  // random bits, shown at /share/<token>, revoked by nulling it. Turning
  // sharing on when it's already on keeps the existing token so a copied
  // link isn't silently invalidated.
  setSharing: protectedProcedure
    .input(z.object({ viewId: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const view = await db.query.views.findFirst({
        where: activeView(input.viewId, ctx.organizationId),
      });
      if (!view) throw new NotFoundError("View");

      const shareToken = input.enabled
        ? (view.shareToken ?? randomBytes(24).toString("base64url"))
        : null;

      const [updated] = await db
        .update(views)
        .set({ shareToken })
        .where(activeView(input.viewId, ctx.organizationId))
        .returning();
      return { shareToken: updated.shareToken };
    }),

  // Templates: a named copy of a view's current schema, reusable as the
  // starting point for new views. The copy is taken server-side from the
  // view's own current version — a client can't smuggle in a schema the
  // view never had.
  saveAsTemplate: protectedProcedure
    .input(z.object({ viewId: z.string().uuid(), name: z.string().min(1).max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const view = await db.query.views.findFirst({
        where: activeView(input.viewId, ctx.organizationId),
      });
      if (!view?.currentVersionId) throw new NotFoundError("View");

      const version = await db.query.viewVersions.findFirst({
        where: eq(viewVersions.id, view.currentVersionId),
      });
      if (!version) throw new Error("View has no current version");

      const [template] = await db
        .insert(viewTemplates)
        .values({
          organizationId: ctx.organizationId,
          name: input.name ?? view.name,
          schemaJson: version.schemaJson,
          createdBy: ctx.userId,
        })
        .returning();
      return template;
    }),

  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    return db.query.viewTemplates.findMany({
      where: eq(viewTemplates.organizationId, ctx.organizationId),
      orderBy: desc(viewTemplates.createdAt),
    });
  }),

  createFromTemplate: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.query.viewTemplates.findFirst({
        where: and(
          eq(viewTemplates.id, input.templateId),
          eq(viewTemplates.organizationId, ctx.organizationId)
        ),
      });
      if (!template) throw new NotFoundError("Template");

      // Re-validated through the DSL on the way out of storage, and always
      // born personal — instantiating a template is not a publish.
      const schema = viewSchema.parse(template.schemaJson);
      return createView({
        organizationId: ctx.organizationId,
        ownerId: ctx.userId,
        name: template.name,
        schema: { ...schema, scope: "personal" },
        createdBy: "user",
        promptText: `Created from template "${template.name}"`,
      });
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(viewTemplates)
        .where(
          and(
            eq(viewTemplates.id, input.templateId),
            eq(viewTemplates.organizationId, ctx.organizationId)
          )
        );
      return { id: input.templateId };
    }),
});
