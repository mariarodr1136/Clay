import { queryCatalog } from "@/server/data-access/catalog";
import { createView } from "@/server/db/create-view";
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
  ctx: { organizationId: string; ownerId: string; promptText: string },
  input: z.infer<typeof proposeViewInputSchema>
): Promise<{ ok: true; viewId: string; name: string } | { ok: false; error: string }> {
  const bad = invalidQueryIds(input.schema);
  if (bad.length > 0) {
    return {
      ok: false,
      error: `Unknown query catalog id(s): ${bad.join(", ")}. Valid ids: ${Object.keys(queryCatalog).join(", ")}`,
    };
  }

  const { view } = await createView({
    organizationId: ctx.organizationId,
    ownerId: ctx.ownerId,
    name: input.name,
    schema: input.schema,
    createdBy: "agent",
    promptText: ctx.promptText,
  });

  return { ok: true, viewId: view.id, name: view.name };
}
