import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { ExportColumn, ExportDataset } from "./datasets";
import { toCsv } from "./csv";
import { renderPagePdf } from "./pdf";

// Shared request/response plumbing for the live and demo export routes, so
// the two can't drift on filename escaping or filter parsing.

export const exportQuerySchema = z.object({
  format: z.enum(["csv", "xlsx", "pdf"]),
  // Required for csv (a single widget's data); ignored for xlsx, which
  // always covers the whole view.
  widgetId: z.string().min(1).optional(),
  filters: z.record(z.string(), z.string()).default({}),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;

function parseFilters(raw: string | null): unknown {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function parseExportQuery(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return exportQuerySchema.safeParse({
    format: params.get("format") ?? undefined,
    widgetId: params.get("widgetId") ?? undefined,
    filters: parseFilters(params.get("filters")),
  });
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "view";
}

function contentDisposition(filename: string): string {
  // filename* carries the real (possibly non-ASCII) name; the plain filename
  // is an ASCII-safe fallback for older clients.
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function csvResponse(dataset: ExportDataset, viewName: string, generatedAt: Date): Response {
  const filename = `${slugify(viewName)}-${slugify(dataset.title)}-${generatedAt
    .toISOString()
    .slice(0, 10)}.csv`;
  return new Response(toCsv(dataset.columns satisfies ExportColumn[], dataset.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(filename),
    },
  });
}

export function pdfResponse(pdf: Buffer, viewName: string, generatedAt: Date): Response {
  const filename = `${slugify(viewName)}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(filename),
    },
  });
}

export function xlsxResponse(workbook: Buffer, viewName: string, generatedAt: Date): Response {
  const filename = `${slugify(viewName)}-${generatedAt.toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(filename),
    },
  });
}

// A PDF render can fail for reasons a download can't express (headless
// browser unavailable, page never settled), so it returns a readable 502
// rather than an empty file the browser would happily "download".
export async function renderPdfOrError(
  url: string,
  viewName: string,
  generatedAt: Date
): Promise<Response> {
  try {
    return pdfResponse(await renderPagePdf(url), viewName, generatedAt);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Couldn't generate the PDF: ${detail}`, { status: 502 });
  }
}
