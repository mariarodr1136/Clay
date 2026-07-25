import "server-only";
import type { DemoViewDef, DemoWidget } from "@/fixtures/demo-dashboards";
import { runDemoQuery } from "@/fixtures/demo-data";
import {
  collectDatasets,
  collectWidgetDatasetFrom,
  humanize,
  type DatasetRunner,
  type ExportColumn,
  type ExportDataset,
  type ExportableWidget,
} from "./datasets";

// The demo's fixtures are static and already fully in memory, so there's no
// cap to hit and nothing to truncate.
const demoRunner: DatasetRunner = async (queryId, params) => ({
  rows: runDemoQuery(queryId, params),
  truncated: false,
  rowLimit: null,
});

// /demo renders a superset of the live DSL (extra chart variants, KPI
// deltas, person/tags columns), so it needs its own normalization — but it
// exports through exactly the same planner, workbook writer, and CSV writer.
function referencedColumns(widget: DemoWidget): ExportColumn[] {
  switch (widget.type) {
    case "table":
      return widget.config.columns.map((c) => ({ key: c.key, label: c.label }));
    case "chart": {
      const { xField, series, donut } = widget.config;
      const columns: ExportColumn[] = [];
      if (donut) {
        columns.push({ key: donut.nameField, label: humanize(donut.nameField) });
        columns.push({ key: donut.valueField, label: humanize(donut.valueField) });
      }
      if (xField) columns.push({ key: xField, label: humanize(xField) });
      for (const s of series ?? []) columns.push({ key: s.key, label: s.label });
      return columns;
    }
    case "progress":
      return [
        { key: widget.config.nameField, label: humanize(widget.config.nameField) },
        { key: widget.config.valueField, label: humanize(widget.config.valueField) },
      ];
    case "kpi":
      return widget.config.field
        ? [{ key: widget.config.field, label: humanize(widget.config.field) }]
        : [];
    default:
      return [];
  }
}

export function toExportableDemoWidgets(view: DemoViewDef): ExportableWidget[] {
  return view.widgets.flatMap((widget) => {
    // filterBar and text carry no query; a KPI may show a literal figure
    // rather than an aggregate, in which case there's nothing to export.
    if (!("query" in widget) || !widget.query) return [];
    return [
      {
        id: widget.id,
        title: widget.title,
        queryId: widget.query.queryId,
        params: widget.query.params ?? {},
        columns: referencedColumns(widget),
      },
    ];
  });
}

export async function collectDemoViewDatasets(
  view: DemoViewDef,
  filters: Record<string, string>
): Promise<ExportDataset[]> {
  return collectDatasets(demoRunner, toExportableDemoWidgets(view), filters);
}

export async function collectDemoWidgetDataset(
  view: DemoViewDef,
  widgetId: string,
  filters: Record<string, string>
): Promise<ExportDataset | null> {
  return collectWidgetDatasetFrom(demoRunner, toExportableDemoWidgets(view), widgetId, filters);
}
