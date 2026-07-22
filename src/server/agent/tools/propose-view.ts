import { queryCatalog } from "@/server/data-access/catalog";
import { createView, patchView } from "@/server/db/create-view";
import type { proposeViewInputSchema } from "./schemas";
import type { z } from "zod";

// Checks every data-bound widget's queryId is real AND that its params
// actually satisfy that query's own zod schema (e.g. row-cap limits) —
// catching this now means a bad proposal gets rejected with feedback the
// agent can act on, rather than being persisted and only failing later
// when a widget tries to render.
function invalidDataBindings(schema: z.infer<typeof proposeViewInputSchema>["schema"]) {
  const errors: string[] = [];
  for (const widget of schema.widgets) {
    if (!("dataBinding" in widget)) continue;
    const entry = queryCatalog[widget.dataBinding.queryId as keyof typeof queryCatalog];
    if (!entry) {
      errors.push(
        `Widget "${widget.id}": unknown query catalog id "${widget.dataBinding.queryId}". Valid ids: ${Object.keys(queryCatalog).join(", ")}`
      );
      continue;
    }
    const result = entry.paramsSchema.safeParse(widget.dataBinding.params);
    if (!result.success) {
      errors.push(
        `Widget "${widget.id}": invalid params for "${widget.dataBinding.queryId}" — ${result.error.issues.map((i) => i.message).join("; ")}`
      );
    }
  }
  return errors;
}

export async function proposeViewTool(
  // viewId comes from the calling page's context (which view the user has
  // open), never from the model's tool input — the model can't choose to
  // overwrite a different view than the one the user is actually looking at.
  ctx: { organizationId: string; ownerId: string; promptText: string; viewId?: string },
  input: z.infer<typeof proposeViewInputSchema>
): Promise<{ ok: true; viewId: string; name: string } | { ok: false; error: string }> {
  const errors = invalidDataBindings(input.schema);
  if (errors.length > 0) {
    return { ok: false, error: errors.join(" | ") };
  }

  try {
    const { view } = ctx.viewId
      ? // patchView preserves the view's existing scope regardless of what
        // the proposed schema says — editing a view's widgets can never
        // change its publish state as a side effect.
        await patchView({
          organizationId: ctx.organizationId,
          viewId: ctx.viewId,
          name: input.name,
          schema: input.schema,
          createdBy: "agent",
          promptText: ctx.promptText,
        })
      : // Publishing a view org-wide must always be an explicit human action
        // (views.publish), never something the agent decides when creating
        // one — force personal scope regardless of what was proposed.
        await createView({
          organizationId: ctx.organizationId,
          ownerId: ctx.ownerId,
          name: input.name,
          schema: { ...input.schema, scope: "personal" },
          createdBy: "agent",
          promptText: ctx.promptText,
        });

    return { ok: true, viewId: view.id, name: view.name };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
