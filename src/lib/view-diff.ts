import type { ViewInput, Widget, LayoutItem } from "@/lib/dsl/schema";

export type ViewDiffOp = "add" | "remove" | "change";

export type ViewDiffLine = { op: ViewDiffOp; text: string };

function describeWidget(widget: Widget): string {
  const title = "title" in widget && widget.title ? ` "${widget.title}"` : "";
  if (widget.type === "chart") return `${widget.config.chartType} chart${title}`;
  if (widget.type === "kpi" || widget.type === "computedField") {
    return `KPI${title || ` "${widget.config.label}"`}`;
  }
  if (widget.type === "filterBar") return `filter bar "${widget.config.label}"`;
  return `${widget.type}${title}`;
}

function layoutChanged(a: LayoutItem, b: LayoutItem): string | null {
  const resized = a.w !== b.w || a.h !== b.h;
  const moved = a.x !== b.x || a.y !== b.y;
  if (resized && moved) return "resized and moved";
  if (resized) return `resized ${a.w}×${a.h} → ${b.w}×${b.h}`;
  if (moved) return "moved";
  return null;
}

// Human-readable, structural summary of what changed between two versions of
// a view — the audit-log vocabulary ("+ donut chart", "± velocity chart")
// computed for real instead of hand-written. Deliberately coarse: it names
// what changed, not every leaf of the config JSON.
export function diffViews(older: ViewInput, newer: ViewInput): ViewDiffLine[] {
  const lines: ViewDiffLine[] = [];

  if (older.name !== newer.name) {
    lines.push({ op: "change", text: `renamed "${older.name}" → "${newer.name}"` });
  }

  const olderById = new Map(older.widgets.map((w) => [w.id, w]));
  const newerById = new Map(newer.widgets.map((w) => [w.id, w]));
  const olderLayout = new Map(older.layout.widgets.map((l) => [l.id, l]));
  const newerLayout = new Map(newer.layout.widgets.map((l) => [l.id, l]));

  for (const widget of newer.widgets) {
    if (!olderById.has(widget.id)) {
      lines.push({ op: "add", text: describeWidget(widget) });
    }
  }

  for (const widget of older.widgets) {
    const next = newerById.get(widget.id);
    if (!next) {
      lines.push({ op: "remove", text: describeWidget(widget) });
      continue;
    }

    if (next.type !== widget.type) {
      lines.push({
        op: "change",
        text: `${describeWidget(widget)} → ${describeWidget(next)}`,
      });
      continue;
    }

    const configChanged = JSON.stringify(widget) !== JSON.stringify(next);
    if (configChanged) {
      lines.push({ op: "change", text: `${describeWidget(next)}: settings changed` });
    }

    const before = olderLayout.get(widget.id);
    const after = newerLayout.get(widget.id);
    if (before && after) {
      const change = layoutChanged(before, after);
      if (change) lines.push({ op: "change", text: `${describeWidget(next)}: ${change}` });
    }
  }

  return lines;
}
