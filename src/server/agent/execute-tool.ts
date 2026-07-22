import { runQueryInputSchema, getViewInputSchema, proposeViewInputSchema } from "./tools/schemas";
import { describeEntities } from "./tools/describe-entities";
import { runQueryTool } from "./tools/run-query";
import { getViewTool } from "./tools/get-view";
import { proposeViewTool } from "./tools/propose-view";
import { listQueryCatalog } from "@/server/data-access/catalog";

export type ExecuteContext = {
  organizationId: string;
  ownerId: string;
  promptText: string;
  viewId?: string;
};

export type ExecuteResult = {
  ok: boolean;
  content: string;
  summary: string;
  viewId?: string;
  name?: string;
};

// Every tool_use block from the model is untrusted JSON until it passes its
// zod schema here — a validation failure comes back as a normal (is_error)
// tool_result, so the model can see what was wrong and retry, rather than
// the whole request failing.
export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ExecuteContext
): Promise<ExecuteResult> {
  switch (name) {
    case "describe_entities": {
      const data = describeEntities();
      return { ok: true, content: JSON.stringify(data), summary: "Described the data model" };
    }

    case "list_query_catalog": {
      const data = listQueryCatalog();
      return {
        ok: true,
        content: JSON.stringify(data),
        summary: `Listed ${data.length} catalog queries`,
      };
    }

    case "run_query": {
      const parsed = runQueryInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return { ok: false, content: parsed.error.message, summary: "Invalid run_query input" };
      }
      const result = await runQueryTool(ctx.organizationId, parsed.data);
      return result.ok
        ? { ok: true, content: JSON.stringify(result.data), summary: `Ran ${parsed.data.queryId}` }
        : { ok: false, content: result.error, summary: `run_query failed: ${result.error}` };
    }

    case "get_view": {
      const parsed = getViewInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return { ok: false, content: parsed.error.message, summary: "Invalid get_view input" };
      }
      const result = await getViewTool(ctx.organizationId, parsed.data);
      return result.ok
        ? { ok: true, content: JSON.stringify(result.schema), summary: `Fetched view "${result.name}"` }
        : { ok: false, content: result.error, summary: result.error };
    }

    case "propose_view": {
      const parsed = proposeViewInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return { ok: false, content: parsed.error.message, summary: "Invalid propose_view input" };
      }
      const result = await proposeViewTool(ctx, parsed.data);
      const verb = ctx.viewId ? "Updated" : "Created";
      return result.ok
        ? {
            ok: true,
            content: `${verb} view ${result.viewId}`,
            summary: `${verb} view "${result.name}"`,
            viewId: result.viewId,
            name: result.name,
          }
        : { ok: false, content: result.error, summary: `propose_view failed: ${result.error}` };
    }

    default:
      return { ok: false, content: `Unknown tool: ${name}`, summary: `Unknown tool: ${name}` };
  }
}
