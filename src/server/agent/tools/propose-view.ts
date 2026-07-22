import { queryCatalog } from "@/server/data-access/catalog";
import { createView, patchView } from "@/server/db/create-view";
import type { proposeViewInputSchema } from "./schemas";
import type { z } from "zod";

function invalidQueryIds(schema: z.infer<typeof proposeViewInputSchema>["schema"]) {
  const validIds = new Set(Object.keys(queryCatalog));
  const invalid = new Set<string>();
  for (const widget of schema.widgets) {
    if ("dataBinding" in widget && !validIds.has(widget.dataBinding.queryId)) {
      invalid.add(widget.dataBinding.queryId);
    }
  }
  return [...invalid];
}

export async function proposeViewTool(
  // viewId comes from the calling page's context (which view the user has
  // open), never from the model's tool input — the model can't choose to
  // overwrite a different view than the one the user is actually looking at.
  ctx: { organizationId: string; ownerId: string; promptText: string; viewId?: string },
  input: z.infer<typeof proposeViewInputSchema>
): Promise<{ ok: true; viewId: string; name: string } | { ok: false; error: string }> {
  const bad = invalidQueryIds(input.schema);
  if (bad.length > 0) {
    return {
      ok: false,
      error: `Unknown query catalog id(s): ${bad.join(", ")}. Valid ids: ${Object.keys(queryCatalog).join(", ")}`,
    };
  }

  try {
    const { view } = ctx.viewId
      ? await patchView({
          organizationId: ctx.organizationId,
          viewId: ctx.viewId,
          name: input.name,
          schema: input.schema,
          createdBy: "agent",
          promptText: ctx.promptText,
        })
      : await createView({
          organizationId: ctx.organizationId,
          ownerId: ctx.ownerId,
          name: input.name,
          schema: input.schema,
          createdBy: "agent",
          promptText: ctx.promptText,
        });

    return { ok: true, viewId: view.id, name: view.name };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
