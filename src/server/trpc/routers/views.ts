import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { views, viewVersions } from "@/server/db/schema";
import { viewSchema } from "@/lib/dsl/schema";
import { runCatalogQuery } from "@/server/data-access/catalog";
import { createView } from "@/server/db/create-view";

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
});
