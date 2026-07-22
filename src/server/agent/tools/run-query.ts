import { runCatalogQuery } from "@/server/data-access/catalog";
import type { runQueryInputSchema } from "./schemas";
import type { z } from "zod";

// Errors (unknown queryId, bad params) are returned as plain text rather
// than thrown — the agent sees them as a tool result and can self-correct
// (e.g. retry with a valid queryId) instead of the whole turn failing.
export async function runQueryTool(
  organizationId: string,
  input: z.infer<typeof runQueryInputSchema>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const data = await runCatalogQuery(organizationId, input.queryId, input.params);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
