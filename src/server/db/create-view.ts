import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { views, viewVersions, type ViewVersionCreator } from "./schema";
import type { ViewInput } from "@/lib/dsl/schema";

// Single persistence path for a new view, used by both the manual "create
// view" UI action and the agent's propose_view tool — createdBy/promptText
// are the only things that differ between the two callers.
export async function createView(params: {
  organizationId: string;
  ownerId: string;
  name: string;
  schema: ViewInput;
  createdBy: ViewVersionCreator;
  promptText?: string;
}) {
  return db.transaction(async (tx) => {
    const [view] = await tx
      .insert(views)
      .values({
        organizationId: params.organizationId,
        ownerId: params.ownerId,
        scope: params.schema.scope,
        name: params.name,
      })
      .returning();

    const [version] = await tx
      .insert(viewVersions)
      .values({
        viewId: view.id,
        schemaJson: params.schema,
        createdBy: params.createdBy,
        promptText: params.promptText,
      })
      .returning();

    const [updated] = await tx
      .update(views)
      .set({ currentVersionId: version.id })
      .where(eq(views.id, view.id))
      .returning();

    return { view: updated, schema: version.schemaJson as ViewInput };
  });
}

// Appends a new version to an existing, org-scoped view rather than
// creating a new one — this is what makes conversational follow-ups
// ("make this chart bigger") edit the view in place. parentVersionId is
// always whatever was current before this call, whether the new content
// came from an agent edit or a revert, so the version chain stays a
// faithful history regardless of how a version came to be.
export async function patchView(params: {
  organizationId: string;
  viewId: string;
  name?: string;
  schema: ViewInput;
  createdBy: ViewVersionCreator;
  promptText?: string;
}) {
  return db.transaction(async (tx) => {
    const view = await tx.query.views.findFirst({
      where: and(eq(views.id, params.viewId), eq(views.organizationId, params.organizationId)),
    });
    if (!view) {
      throw new Error("View not found");
    }

    // A patch can never change publish state as a side effect — the stored
    // snapshot's scope always mirrors the view's real (already-persisted)
    // scope, regardless of what the caller's schema says. Only
    // views.publish/unpublish may change it.
    const schema: ViewInput = { ...params.schema, scope: view.scope };

    const [version] = await tx
      .insert(viewVersions)
      .values({
        viewId: view.id,
        schemaJson: schema,
        createdBy: params.createdBy,
        promptText: params.promptText,
        parentVersionId: view.currentVersionId,
      })
      .returning();

    const [updated] = await tx
      .update(views)
      .set({
        currentVersionId: version.id,
        name: params.name ?? view.name,
        updatedAt: new Date(),
      })
      .where(eq(views.id, view.id))
      .returning();

    return { view: updated, schema: version.schemaJson as ViewInput };
  });
}
