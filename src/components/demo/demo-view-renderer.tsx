"use client";

import { useState } from "react";
import type { DemoViewDef, DemoWidget } from "@/fixtures/demo-dashboards";
import { DemoTableWidget } from "./widgets/demo-table-widget";
import { DemoKpiWidget } from "./widgets/demo-kpi-widget";
import { DemoChartWidget } from "./widgets/demo-chart-widget";
import { DemoProgressWidget } from "./widgets/demo-progress-widget";
import { FilterBarWidget } from "@/components/renderer/widgets/filter-bar-widget";
import { Card, CardContent } from "@/components/ui/card";

// Exported for the demo layout editor, which renders the same widgets but
// owns its own grid geometry.
export function DemoWidgetSwitch({
  widget,
  filters,
  onFilterChange,
}: {
  widget: DemoWidget;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}) {
  switch (widget.type) {
    case "table":
      return <DemoTableWidget widget={widget} filters={filters} />;
    case "kpi":
      return <DemoKpiWidget widget={widget} filters={filters} />;
    case "chart":
      return <DemoChartWidget widget={widget} filters={filters} />;
    case "progress":
      return <DemoProgressWidget widget={widget} filters={filters} />;
    case "filterBar":
      return <FilterBarWidget widget={widget} filters={filters} onFilterChange={onFilterChange} />;
    case "text":
      return (
        <Card className="h-full justify-center py-4">
          <CardContent className="text-muted-foreground text-sm leading-relaxed">
            {widget.config.content}
          </CardContent>
        </Card>
      );
  }
}

// Same 12-column grid contract as the live ViewRenderer, but rendering the
// richer demo widget set against static fixtures via runDemoQuery — no auth,
// no DB, matching the rest of /demo.
export function DemoViewRenderer({
  view,
  // Mirrors the live ViewRenderer: export needs to know what's currently
  // filtered so a downloaded file matches the screen it came from.
  onFiltersChange,
  // Lets the print page open already filtered, so a PDF reflects the filter
  // bar as the user left it.
  initialFilters = {},
}: {
  view: DemoViewDef;
  onFiltersChange?: (filters: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}) {
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const layoutById = new Map(view.layout.map((l) => [l.id, l]));

  const handleFilterChange = (key: string, value: string) => {
    const next = { ...filters };
    if (value) next[key] = value;
    else delete next[key];
    setFilters(next);
    onFiltersChange?.(next);
  };

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: "96px" }}
    >
      {view.widgets.map((widget) => {
        const layoutItem = layoutById.get(widget.id);
        if (!layoutItem) return null;
        return (
          <div
            key={widget.id}
            className="min-w-0"
            style={{
              gridColumn: `${layoutItem.x + 1} / span ${layoutItem.w}`,
              gridRow: `${layoutItem.y + 1} / span ${layoutItem.h}`,
            }}
          >
            <DemoWidgetSwitch widget={widget} filters={filters} onFilterChange={handleFilterChange} />
          </div>
        );
      })}
    </div>
  );
}
