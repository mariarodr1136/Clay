import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { organizations, views, viewVersions } from "@/server/db/schema";
import { ensureUserOrg } from "@/server/auth/ensure-user-org";
import { parseView } from "@/lib/dsl/validate";
import { collectViewDatasets, collectWidgetDataset } from "@/server/export/datasets";
import { buildViewWorkbook } from "@/server/export/xlsx";
import {
  csvResponse,
  parseExportQuery,
  renderPdfOrError,
  xlsxResponse,
} from "@/server/export/http";
import { signPrintToken } from "@/server/export/print-token";

// Exports re-run the view's bindings server-side through the same
// allow-listed, org-scoped catalog the renderer uses — never from rows the
// client happens to be holding. One authorization path, exact numbers, and
// the export ceiling instead of the widget's 50-row default.

export async function GET(request: NextRequest, ctx: { params: Promise<{ viewId: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { organizationId } = await ensureUserOrg();
  const { viewId } = await ctx.params;

  const parsedQuery = parseExportQuery(request);
  if (!parsedQuery.success) {
    return new Response("Invalid export request", { status: 400 });
  }
  const { format, widgetId, filters } = parsedQuery.data;

  const view = await db.query.views.findFirst({
    where: and(eq(views.id, viewId), eq(views.organizationId, organizationId)),
  });
  if (!view?.currentVersionId) return new Response("View not found", { status: 404 });

  const version = await db.query.viewVersions.findFirst({
    where: eq(viewVersions.id, view.currentVersionId),
  });
  if (!version) return new Response("View has no current version", { status: 404 });

  const parsed = parseView(version.schemaJson);
  if (!parsed.success) {
    return new Response(`View schema is invalid: ${parsed.error}`, { status: 422 });
  }

  const generatedAt = new Date();

  if (format === "pdf") {
    // The headless browser has no session, so it carries a short-lived
    // signed token naming this view, this org, and these filters.
    const url = new URL(`/print/views/${viewId}`, request.nextUrl.origin);
    url.searchParams.set("token", signPrintToken({ viewId, organizationId, filters }));
    return renderPdfOrError(url.toString(), view.name, generatedAt);
  }

  if (format === "csv") {
    if (!widgetId) return new Response("csv exports require a widgetId", { status: 400 });

    const dataset = await collectWidgetDataset(organizationId, parsed.data, widgetId, filters);
    if (!dataset) return new Response("Widget not found or has no data", { status: 404 });

    return csvResponse(dataset, view.name, generatedAt);
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  const datasets = await collectViewDatasets(organizationId, parsed.data, filters);
  if (datasets.length === 0) {
    return new Response("This view has no data-bound widgets to export", { status: 422 });
  }

  const workbook = await buildViewWorkbook(
    {
      viewName: view.name,
      promptText: version.promptText,
      facts: [
        ...(org ? ([["Workspace", org.name]] as [string, string][]) : []),
        ["Current version by", version.createdBy],
        ["Version created", version.createdAt.toISOString()],
      ],
      generatedAt,
      filters,
    },
    datasets
  );

  return xlsxResponse(workbook, view.name, generatedAt);
}
