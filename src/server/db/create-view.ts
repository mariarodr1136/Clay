import { eq } from "drizzle-orm";
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
