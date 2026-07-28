import type { LayoutItem, ViewInput, Widget } from "./schema";

// Structural quality checks that sit above Zod validation.
//
// The schema answers "is this well-formed?" — unique ids, every widget has a
// layout entry, fields are the right types. It does not answer "will this
// render as a usable dashboard?", and those are different questions: a view
// where two widgets claim the same grid cells parses perfectly and then
// stacks them on top of each other.
//
// Used in two places. propose_view rejects errors before persisting, so the
// agent gets actionable feedback and retries instead of shipping a broken
// layout. The eval harness grades against the same rules, so "did the model
// produce a good view?" is measured by the same definition the product
// enforces.

const COLS = 12;

export type QualityProblem = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

function layoutById(view: ViewInput): Map<string, LayoutItem> {
  return new Map(view.layout.widgets.map((item) => [item.id, item]));
}

// True when two grid rectangles share any cell.
function overlaps(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function checkLayout(view: ViewInput, problems: QualityProblem[]) {
  const items = view.layout.widgets;

  for (const item of items) {
    // x maxes at 11 and w at 12 independently, so the schema happily accepts
    // x:10 w:12 — a widget spanning to column 22 of a 12-column grid.
    if (item.x + item.w > COLS) {
      problems.push({
        severity: "error",
        code: "layout.overflow",
        message: `Widget "${item.id}" starts at column ${item.x + 1} and is ${item.w} wide, which runs past the ${COLS}-column grid. Reduce w to at most ${COLS - item.x}.`,
      });
    }
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) {
        problems.push({
          severity: "error",
          code: "layout.overlap",
          message: `Widgets "${items[i].id}" and "${items[j].id}" occupy the same grid cells and would render on top of each other. Give them different x/y positions.`,
        });
      }
    }
  }

  // The schema catches widgets missing a layout entry; this is the reverse —
  // a layout entry pointing at a widget that doesn't exist, which silently
  // reserves empty space.
  const widgetIds = new Set(view.widgets.map((w) => w.id));
  for (const item of items) {
    if (!widgetIds.has(item.id)) {
      problems.push({
        severity: "error",
        code: "layout.orphan",
        message: `Layout entry "${item.id}" doesn't match any widget.`,
      });
    }
  }
}

function checkWidget(widget: Widget, layout: LayoutItem | undefined, problems: QualityProblem[]) {
  if (widget.type === "chart") {
    const config = widget.config;
    if (config.chartType === "donut") {
      if (!config.donut) {
        problems.push({
          severity: "error",
          code: "chart.donut.missingConfig",
          message: `Chart "${widget.id}" is a donut but has no config.donut { nameField, valueField }.`,
        });
      }
    } else {
      if (!config.xField) {
        problems.push({
          severity: "error",
          code: "chart.missingXField",
          message: `Chart "${widget.id}" is a ${config.chartType} chart and needs an xField.`,
        });
      }
      if (!config.yField && (!config.series || config.series.length === 0)) {
        problems.push({
          severity: "error",
          code: "chart.missingSeries",
          message: `Chart "${widget.id}" needs either a yField or a non-empty series array.`,
        });
      }
    }

    // Not wrong, just unreadable — a chart squeezed into a few columns loses
    // its axis labels entirely.
    if (layout && layout.w < 5) {
      problems.push({
        severity: "warning",
        code: "chart.tooNarrow",
        message: `Chart "${widget.id}" is only ${layout.w} columns wide; charts need at least 5 to stay legible.`,
      });
    }
  }

  if (widget.type === "table" && widget.config.columns.length === 0) {
    problems.push({
      severity: "error",
      code: "table.noColumns",
      message: `Table "${widget.id}" has no columns.`,
    });
  }

  if (widget.type === "table" && widget.config.statusActions) {
    const hasStatusColumn = widget.config.columns.some((column) => column.kind === "status");
    if (!hasStatusColumn) {
      problems.push({
        severity: "warning",
        code: "table.statusActionsWithoutColumn",
        message: `Table "${widget.id}" enables statusActions but has no column of kind "status", so there's nothing to click.`,
      });
    }
  }
}

export function findViewProblems(view: ViewInput): QualityProblem[] {
  const problems: QualityProblem[] = [];
  const layout = layoutById(view);

  checkLayout(view, problems);
  for (const widget of view.widgets) {
    checkWidget(widget, layout.get(widget.id), problems);
  }

  return problems;
}

export function viewErrors(view: ViewInput): QualityProblem[] {
  return findViewProblems(view).filter((problem) => problem.severity === "error");
}
