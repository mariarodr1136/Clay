import "server-only";
import type { ViewInput } from "@/lib/dsl/schema";
import { runCatalogQuery } from "@/server/data-access/catalog";
import { planDatasets, toExportableWidgets } from "./datasets";
import type { PreloadedQueries } from "@/components/renderer/preloaded-data";

// Resolves every binding in a view server-side, keyed the way the widgets
// will look them up. Used by the print page, which has no session and so
// can't call tRPC.
//
// Deliberately runs the *interactive* query path, not the export one: a PDF
// should be the dashboard on paper, so its tables show the same rows the
// screen does rather than a 5,000-row extract. The spreadsheet is where the
// complete data lives.
export async function preloadViewQueries(
  organizationId: string,
  view: ViewInput,
  filters: Record<string, string>
): Promise<PreloadedQueries> {
  const planned = planDatasets(toExportableWidgets(view.widgets), filters);

  const entries = await Promise.all(
    planned.map(async (dataset) => {
      const rows = (await runCatalogQuery(organizationId, dataset.queryId, dataset.params)) as
        | Record<string, unknown>[]
        | null;
      return [dataset.key, Array.isArray(rows) ? rows : []] as const;
    })
  );

  return Object.fromEntries(entries);
}
