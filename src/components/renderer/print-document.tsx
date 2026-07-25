"use client";

import { ViewRenderer } from "./view-renderer";
import { PreloadedQueriesProvider, type PreloadedQueries } from "./preloaded-data";
import { PrintReadyMarker } from "./print-ready";
import { StaticChartsProvider } from "@/components/charts/static-charts";

export type PrintHeader = {
  title: string;
  prompt: string | null;
  meta: string;
  // Formatted on the server and passed down. Calling new Date() while
  // rendering would produce a different string on the server than on the
  // client and fail hydration — which, in the PDF path, means React throws
  // the tree away and re-renders exactly when we're trying to capture it.
  generatedAt: string;
  filters: Record<string, string>;
};

export function PrintDocumentHeader({ title, prompt, meta, generatedAt, filters }: PrintHeader) {
  const applied = Object.entries(filters);
  return (
    <header className="space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {prompt && <p className="text-muted-foreground text-sm italic">&ldquo;{prompt}&rdquo;</p>}
      <p className="text-muted-foreground text-xs">
        {meta} · Exported {generatedAt}
        {applied.length > 0 &&
          ` · Filters: ${applied.map(([key, value]) => `${key} = ${value}`).join(", ")}`}
      </p>
    </header>
  );
}

// The live view, rendered for paper: same ViewRenderer and same widgets as
// the app, but with rows resolved server-side (there's no session here) and
// chart animation off so nothing is captured half-drawn.
export function PrintDocument({
  schema,
  preloaded,
  header,
}: {
  schema: unknown;
  preloaded: PreloadedQueries;
  header: PrintHeader;
}) {
  return (
    <PreloadedQueriesProvider value={preloaded}>
      <StaticChartsProvider>
        <div className="space-y-6">
          <PrintDocumentHeader {...header} />
          <ViewRenderer schema={schema} initialFilters={header.filters} />
        </div>
        <PrintReadyMarker />
      </StaticChartsProvider>
    </PreloadedQueriesProvider>
  );
}
