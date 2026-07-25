import type { NextRequest } from "next/server";
import { demoViewById } from "@/fixtures/demo-dashboards";
import { demoPerson } from "@/fixtures/demo-data";
import { collectDemoViewDatasets, collectDemoWidgetDataset } from "@/server/export/demo-datasets";
import { buildViewWorkbook } from "@/server/export/xlsx";
import {
  csvResponse,
  parseExportQuery,
  renderPdfOrError,
  xlsxResponse,
} from "@/server/export/http";

// Deliberately unauthenticated, like the rest of /demo: it reads the same
// public fixtures the demo pages already ship to the browser, so there's no
// private data to scope and no session to check. Everything downstream —
// dataset planning, the workbook writer, the CSV writer — is shared with the
// live route, so the demo shows the real export, not a mock of one.

export async function GET(request: NextRequest, ctx: { params: Promise<{ viewId: string }> }) {
  const { viewId } = await ctx.params;

  const parsedQuery = parseExportQuery(request);
  if (!parsedQuery.success) {
    return new Response("Invalid export request", { status: 400 });
  }
  const { format, widgetId, filters } = parsedQuery.data;

  const view = demoViewById(viewId);
  if (!view) return new Response("View not found", { status: 404 });

  const generatedAt = new Date();

  if (format === "pdf") {
    // No token: the print page reads the same public fixtures.
    const url = new URL(`/print/demo/views/${viewId}`, request.nextUrl.origin);
    if (Object.keys(filters).length > 0) url.searchParams.set("filters", JSON.stringify(filters));
    return renderPdfOrError(url.toString(), view.name, generatedAt);
  }

  if (format === "csv") {
    if (!widgetId) return new Response("csv exports require a widgetId", { status: 400 });

    const dataset = await collectDemoWidgetDataset(view, widgetId, filters);
    if (!dataset) return new Response("Widget not found or has no data", { status: 404 });

    return csvResponse(dataset, view.name, generatedAt);
  }

  const datasets = await collectDemoViewDatasets(view, filters);
  if (datasets.length === 0) {
    return new Response("This view has no data-bound widgets to export", { status: 422 });
  }

  const workbook = await buildViewWorkbook(
    {
      viewName: view.name,
      promptText: view.prompt,
      facts: [
        ["Workspace", "Clay demo workspace (sample data)"],
        ["Created by", demoPerson(view.creatorId).name],
        ["Version", `v${view.version}`],
        ["Last updated", view.updatedLabel],
      ],
      generatedAt,
      filters,
    },
    datasets
  );

  return xlsxResponse(workbook, view.name, generatedAt);
}
