import { describe, expect, it } from "vitest";
import { diffViews } from "./view-diff";
import type { ViewInput } from "@/lib/dsl/schema";

const base: ViewInput = {
  name: "Delivery",
  scope: "personal",
  layout: {
    widgets: [
      { id: "kpi1", x: 0, y: 0, w: 4, h: 2 },
      { id: "chart1", x: 0, y: 2, w: 8, h: 3 },
    ],
  },
  widgets: [
    {
      id: "kpi1",
      type: "kpi",
      dataBinding: { queryId: "tasksList", params: {} },
      config: { aggregate: "count", label: "Open tasks", format: "number" },
    },
    {
      id: "chart1",
      type: "chart",
      title: "By status",
      dataBinding: { queryId: "tasksByStatusCount", params: {} },
      config: { chartType: "bar", xField: "status", yField: "count" },
    },
  ],
};

const clone = (v: ViewInput): ViewInput => JSON.parse(JSON.stringify(v));

describe("diffViews", () => {
  it("reports no lines for identical versions", () => {
    expect(diffViews(base, clone(base))).toEqual([]);
  });

  it("reports an added widget", () => {
    const next = clone(base);
    next.widgets.push({
      id: "donut1",
      type: "chart",
      title: "Open by project",
      dataBinding: { queryId: "openTasksByProject", params: {} },
      config: {
        chartType: "donut",
        donut: { nameField: "project", valueField: "count" },
      },
    });
    next.layout.widgets.push({ id: "donut1", x: 8, y: 2, w: 4, h: 3 });

    const lines = diffViews(base, next);
    expect(lines).toEqual([{ op: "add", text: 'donut chart "Open by project"' }]);
  });

  it("reports a removed widget", () => {
    const next = clone(base);
    next.widgets = next.widgets.filter((w) => w.id !== "chart1");
    next.layout.widgets = next.layout.widgets.filter((l) => l.id !== "chart1");

    expect(diffViews(base, next)).toEqual([{ op: "remove", text: 'bar chart "By status"' }]);
  });

  it("reports a rename", () => {
    const next = clone(base);
    next.name = "Delivery v2";
    expect(diffViews(base, next)).toEqual([
      { op: "change", text: 'renamed "Delivery" → "Delivery v2"' },
    ]);
  });

  it("reports a config change", () => {
    const next = clone(base);
    const chart = next.widgets.find((w) => w.id === "chart1");
    if (chart?.type === "chart") chart.config.chartType = "line";

    const lines = diffViews(base, next);
    expect(lines).toEqual([{ op: "change", text: 'line chart "By status": settings changed' }]);
  });

  it("reports a resize without flagging config", () => {
    const next = clone(base);
    next.layout.widgets[1] = { id: "chart1", x: 0, y: 2, w: 12, h: 3 };

    expect(diffViews(base, next)).toEqual([
      { op: "change", text: 'bar chart "By status": resized 8×3 → 12×3' },
    ]);
  });
});
