"use client";

import { useState } from "react";
import { parseView } from "@/lib/dsl/validate";
import type { Widget } from "@/lib/dsl/schema";
import { TableWidget } from "./widgets/table-widget";
import { KpiWidget } from "./widgets/kpi-widget";
import { ChartWidget } from "./widgets/chart-widget";
import { FilterBarWidget } from "./widgets/filter-bar-widget";
import { TextWidget } from "./widgets/text-widget";
import { FormWidget } from "./widgets/form-widget";
import { ProgressWidget } from "./widgets/progress-widget";
import { Card, CardContent } from "@/components/ui/card";

function FallbackWidget({ reason }: { reason: string }) {
  return (
    <Card className="border-destructive/50 h-full">
      <CardContent className="text-destructive text-sm">
        Couldn&apos;t render this widget: {reason}
      </CardContent>
    </Card>
  );
}

// Exported for the layout editor, which renders the same widgets but owns
// its own grid geometry.
export function WidgetSwitch({
  widget,
  filters,
  onFilterChange,
}: {
  widget: Widget;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}) {
  switch (widget.type) {
    case "table":
      return <TableWidget widget={widget} filters={filters} />;
    case "kpi":
    case "computedField":
      return <KpiWidget widget={widget} filters={filters} />;
    case "chart":
      return <ChartWidget widget={widget} filters={filters} />;
    case "filterBar":
      return <FilterBarWidget widget={widget} filters={filters} onFilterChange={onFilterChange} />;
    case "text":
      return <TextWidget widget={widget} />;
    case "form":
      return <FormWidget widget={widget} />;
    case "progress":
      return <ProgressWidget widget={widget} filters={filters} />;
    default:
      // Exhaustiveness guard: a widget type that reaches here is one the
      // renderer's registry hasn't caught up to yet, not a crash.
      return <FallbackWidget reason={`unknown widget type "${(widget as Widget).type}"`} />;
  }
}

// Re-validates at render time (defense in depth against a stale/bad
// version) and fails closed to a fallback widget rather than throwing —
// one bad widget never takes down the rest of the view.
export function ViewRenderer({
  schema,
  // Filter state stays owned here, but export needs to know what's currently
  // applied so a downloaded file matches the screen it came from.
  onFiltersChange,
  // Lets the print page open already filtered, so a PDF reflects the filter
  // bar as the user left it.
  initialFilters = {},
}: {
  schema: unknown;
  onFiltersChange?: (filters: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}) {
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const parsed = parseView(schema);

  if (!parsed.success) {
    return <FallbackWidget reason={parsed.error} />;
  }

  const { widgets, layout } = parsed.data;
  const layoutById = new Map(layout.widgets.map((l) => [l.id, l]));

  // Reading order (top row first, then left to right), which is the order the
  // widgets stack in on a phone and the order they're tabbed through
  // everywhere. Desktop placement is absolute, so this can't move anything
  // visually there. A widget with no layout entry sorts last rather than
  // first: it renders as an error card, and that shouldn't lead the view.
  const ordered = [...widgets].sort((a, b) => {
    const la = layoutById.get(a.id);
    const lb = layoutById.get(b.id);
    if (!la || !lb) return la ? -1 : lb ? 1 : 0;
    return la.y - lb.y || la.x - lb.x;
  });

  const handleFilterChange = (key: string, value: string) => {
    const next = { ...filters };
    if (value) next[key] = value;
    else delete next[key];
    setFilters(next);
    onFiltersChange?.(next);
  };

  // Placement is published as custom properties rather than applied directly:
  // globals.css decides per breakpoint whether to honour the authored grid or
  // stack the widgets full-width. See the .view-grid rules there.
  return (
    <div className="view-grid grid gap-4">
      {ordered.map((widget) => {
        const layoutItem = layoutById.get(widget.id);
        if (!layoutItem) {
          return (
            <div key={widget.id} className="view-grid-item">
              <FallbackWidget reason={`widget "${widget.id}" has no layout entry`} />
            </div>
          );
        }
        return (
          <div
            key={widget.id}
            className="view-grid-item"
            style={
              {
                "--widget-column": `${layoutItem.x + 1} / span ${layoutItem.w}`,
                "--widget-row": `${layoutItem.y + 1} / span ${layoutItem.h}`,
                // Row span as a bare number, so the stacked layout can turn
                // it back into a pixel height. See .view-grid in globals.css.
                "--widget-rows": layoutItem.h,
              } as React.CSSProperties
            }
          >
            <WidgetSwitch widget={widget} filters={filters} onFilterChange={handleFilterChange} />
          </div>
        );
      })}
    </div>
  );
}
