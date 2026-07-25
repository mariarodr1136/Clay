import "server-only";
import type { ViewInput, Widget } from "@/lib/dsl/schema";
import { resolveBindingParams } from "@/lib/dsl/resolve-params";
import { stableQueryKey } from "@/lib/dsl/query-key";
import { runCatalogQueryForExport } from "@/server/data-access/catalog";

export type ExportColumn = { key: string; label: string };

export type ExportDataset = {
  // queryId + resolved params. Widgets that share a binding (a KPI and the
  // table beneath it, say) collapse into one dataset rather than one
  // identical sheet each.
  key: string;
  title: string;
  queryId: string;
  params: Record<string, unknown>;
  widgetIds: string[];
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  rowLimit: number | null;
};

// "dueDate" -> "Due date", "assignee_id" -> "Assignee id".
export function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function bindingOf(widget: Widget) {
  return "dataBinding" in widget ? widget.dataBinding : null;
}

// The fields a widget actually puts on screen, in the order it shows them.
// Exports lead with these so a spreadsheet opens looking like the view it
// came from, rather than like a raw table dump.
function referencedColumns(widget: Widget): ExportColumn[] {
  switch (widget.type) {
    case "table":
      return widget.config.columns.map((c) => ({ key: c.key, label: c.label }));
    case "chart": {
      const { xField, yField, series, donut } = widget.config;
      const columns: ExportColumn[] = [];
      if (donut) {
        columns.push({ key: donut.nameField, label: humanize(donut.nameField) });
        columns.push({ key: donut.valueField, label: humanize(donut.valueField) });
      }
      if (xField) columns.push({ key: xField, label: humanize(xField) });
      if (yField) columns.push({ key: yField, label: humanize(yField) });
      for (const s of series ?? []) columns.push({ key: s.key, label: s.label });
      return columns;
    }
    case "progress":
      return [
        { key: widget.config.nameField, label: humanize(widget.config.nameField) },
        { key: widget.config.valueField, label: humanize(widget.config.valueField) },
      ];
    case "kpi":
    case "computedField":
      // A count-only KPI references no field at all.
      return widget.config.field
        ? [{ key: widget.config.field, label: humanize(widget.config.field) }]
        : [];
    default:
      return [];
  }
}

function dedupeColumns(columns: ExportColumn[]): ExportColumn[] {
  const seen = new Set<string>();
  return columns.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
}

function allRowKeys(rows: Record<string, unknown>[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

// The live DSL and the demo's richer fixture DSL describe widgets
// differently, so both normalize to this before planning. Everything below
// it — dedupe, column ordering, truncation — is then shared.
export type ExportableWidget = {
  id: string;
  title?: string;
  queryId: string;
  params: Record<string, string | number | boolean | null>;
  columns: ExportColumn[];
};

// Injected so the live path can run org-scoped catalog queries while the demo
// path runs its static fixtures.
export type DatasetRunner = (
  queryId: string,
  params: Record<string, unknown>
) => Promise<{ rows: Record<string, unknown>[]; truncated: boolean; rowLimit: number | null }>;

type PlannedDataset = {
  key: string;
  queryId: string;
  params: Record<string, unknown>;
  title: string;
  widgetIds: string[];
  columns: ExportColumn[];
};

export function planDatasets(
  widgets: ExportableWidget[],
  filters: Record<string, string>
): PlannedDataset[] {
  const byKey = new Map<string, PlannedDataset>();

  for (const widget of widgets) {
    const params = resolveBindingParams(widget.params, filters);
    const key = stableQueryKey(widget.queryId, params);
    const existing = byKey.get(key);

    if (existing) {
      existing.widgetIds.push(widget.id);
      existing.columns = dedupeColumns([...existing.columns, ...widget.columns]);
      continue;
    }

    byKey.set(key, {
      key,
      queryId: widget.queryId,
      params,
      title: widget.title ?? humanize(widget.queryId),
      widgetIds: [widget.id],
      columns: dedupeColumns(widget.columns),
    });
  }

  return [...byKey.values()];
}

export async function materialize(
  run: DatasetRunner,
  planned: PlannedDataset,
  includeUnreferencedColumns: boolean
): Promise<ExportDataset> {
  const { rows, truncated, rowLimit } = await run(planned.queryId, planned.params);

  // Referenced columns are kept even if the rows don't carry them: the
  // on-screen widget renders those cells as "—", and a file that quietly
  // dropped a column would no longer match the view it came from.
  const referenced = planned.columns;
  const extras = includeUnreferencedColumns
    ? allRowKeys(rows)
        .filter((key) => !referenced.some((c) => c.key === key))
        .map((key) => ({ key, label: humanize(key) }))
    : [];

  // A widget that references nothing (a count-only KPI) would otherwise
  // export a sheet with no columns at all.
  const columns = referenced.length + extras.length > 0
    ? [...referenced, ...extras]
    : allRowKeys(rows).map((key) => ({ key, label: humanize(key) }));

  return { ...planned, columns, rows, truncated, rowLimit };
}

// The live DSL's widgets, normalized. Widgets with no data binding
// (filterBar, text, form) have nothing to export.
export function toExportableWidgets(widgets: Widget[]): ExportableWidget[] {
  return widgets.flatMap((widget) => {
    const binding = bindingOf(widget);
    if (!binding) return [];
    return [
      {
        id: widget.id,
        title: widget.title,
        queryId: binding.queryId,
        params: binding.params,
        columns: referencedColumns(widget),
      },
    ];
  });
}

// Whole-view export: every distinct binding in the view, with the fields the
// view uses first and the query's remaining fields after them — curated
// enough to read, complete enough to pivot on.
export async function collectDatasets(
  run: DatasetRunner,
  widgets: ExportableWidget[],
  filters: Record<string, string>
): Promise<ExportDataset[]> {
  const planned = planDatasets(widgets, filters);
  return Promise.all(planned.map((p) => materialize(run, p, true)));
}

// Single-widget export: exactly the columns that widget shows, in its order.
// A CSV of a table on screen should match the table on screen.
export async function collectWidgetDatasetFrom(
  run: DatasetRunner,
  widgets: ExportableWidget[],
  widgetId: string,
  filters: Record<string, string>
): Promise<ExportDataset | null> {
  const widget = widgets.find((w) => w.id === widgetId);
  if (!widget) return null;

  const [planned] = planDatasets([widget], filters);
  return materialize(run, planned, false);
}

const catalogRunner =
  (organizationId: string): DatasetRunner =>
  (queryId, params) =>
    runCatalogQueryForExport(organizationId, queryId, params);

export async function collectViewDatasets(
  organizationId: string,
  view: ViewInput,
  filters: Record<string, string>
): Promise<ExportDataset[]> {
  return collectDatasets(catalogRunner(organizationId), toExportableWidgets(view.widgets), filters);
}

export async function collectWidgetDataset(
  organizationId: string,
  view: ViewInput,
  widgetId: string,
  filters: Record<string, string>
): Promise<ExportDataset | null> {
  return collectWidgetDatasetFrom(
    catalogRunner(organizationId),
    toExportableWidgets(view.widgets),
    widgetId,
    filters
  );
}
