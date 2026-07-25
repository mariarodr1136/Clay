"use client";

import type { DemoViewDef } from "@/fixtures/demo-dashboards";
import { DemoViewRenderer } from "./demo-view-renderer";
import { PrintDocumentHeader } from "@/components/renderer/print-document";
import { PrintReadyMarker } from "@/components/renderer/print-ready";
import { StaticChartsProvider } from "@/components/charts/static-charts";

// The demo's fixtures already live in the client bundle, so unlike the live
// print page there's nothing to preload — the renderer resolves its own rows.
export function DemoPrintDocument({
  view,
  creatorName,
  generatedAt,
  filters,
}: {
  view: DemoViewDef;
  creatorName: string;
  generatedAt: string;
  filters: Record<string, string>;
}) {
  return (
    <StaticChartsProvider>
      <div className="space-y-6">
        <PrintDocumentHeader
          title={view.name}
          prompt={view.prompt}
          meta={`Sample data · v${view.version} · created by ${creatorName}`}
          generatedAt={generatedAt}
          filters={filters}
        />
        <DemoViewRenderer view={view} initialFilters={filters} />
      </div>
      <PrintReadyMarker />
    </StaticChartsProvider>
  );
}
