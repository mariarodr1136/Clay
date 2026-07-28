import { describe, expect, it } from "vitest";
import { findViewProblems, viewErrors } from "./quality";
import type { ViewInput } from "./schema";

const table = (id: string) =>
  ({
    id,
    type: "table" as const,
    dataBinding: { queryId: "tasksList", params: {} },
    config: { columns: [{ key: "title", label: "Task" }] },
  });

function view(
  layout: { id: string; x: number; y: number; w: number; h: number }[],
  widgets: ViewInput["widgets"] = layout.map((item) => table(item.id))
): ViewInput {
  return {
    name: "Test view",
    scope: "personal",
    layout: { widgets: layout },
    widgets,
  };
}

// These are the rules propose_view rejects on and the eval harness grades
// against, so they get the same scrutiny as the security suite: a false
// positive blocks the agent from ever producing a view.
describe("view quality", () => {
  it("accepts a tidy layout", () => {
    const result = findViewProblems(
      view([
        { id: "a", x: 0, y: 0, w: 6, h: 2 },
        { id: "b", x: 6, y: 0, w: 6, h: 2 },
        { id: "c", x: 0, y: 2, w: 12, h: 3 },
      ])
    );
    expect(result).toEqual([]);
  });

  it("catches a widget running past the 12-column grid", () => {
    // The schema allows this: x maxes at 11 and w at 12, independently.
    const errors = viewErrors(view([{ id: "a", x: 10, y: 0, w: 12, h: 2 }]));
    expect(errors.map((e) => e.code)).toContain("layout.overflow");
  });

  it("catches two widgets occupying the same cells", () => {
    const errors = viewErrors(
      view([
        { id: "a", x: 0, y: 0, w: 6, h: 2 },
        { id: "b", x: 3, y: 1, w: 6, h: 2 },
      ])
    );
    expect(errors.map((e) => e.code)).toContain("layout.overlap");
  });

  it("does not flag widgets that merely touch edges", () => {
    const errors = viewErrors(
      view([
        { id: "a", x: 0, y: 0, w: 6, h: 2 },
        { id: "b", x: 6, y: 0, w: 6, h: 2 },
        { id: "c", x: 0, y: 2, w: 6, h: 2 },
      ])
    );
    expect(errors).toEqual([]);
  });

  it("catches a layout entry with no matching widget", () => {
    const broken = view([{ id: "a", x: 0, y: 0, w: 6, h: 2 }]);
    broken.layout.widgets.push({ id: "ghost", x: 6, y: 0, w: 6, h: 2 });
    expect(viewErrors(broken).map((e) => e.code)).toContain("layout.orphan");
  });

  it("requires a donut chart to carry its donut config", () => {
    const errors = viewErrors(
      view(
        [{ id: "c", x: 0, y: 0, w: 6, h: 3 }],
        [
          {
            id: "c",
            type: "chart",
            dataBinding: { queryId: "pointsByProject", params: {} },
            config: { chartType: "donut" },
          },
        ]
      )
    );
    expect(errors.map((e) => e.code)).toContain("chart.donut.missingConfig");
  });

  it("requires a cartesian chart to have an x field and a series", () => {
    const errors = viewErrors(
      view(
        [{ id: "c", x: 0, y: 0, w: 6, h: 3 }],
        [
          {
            id: "c",
            type: "chart",
            dataBinding: { queryId: "velocityByWeek", params: {} },
            config: { chartType: "line" },
          },
        ]
      )
    );
    expect(errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(["chart.missingXField", "chart.missingSeries"])
    );
  });

  it("warns about an unreadably narrow chart without blocking it", () => {
    const problems = findViewProblems(
      view(
        [{ id: "c", x: 0, y: 0, w: 3, h: 3 }],
        [
          {
            id: "c",
            type: "chart",
            dataBinding: { queryId: "velocityByWeek", params: {} },
            config: { chartType: "line", xField: "week", yField: "points" },
          },
        ]
      )
    );
    expect(problems.map((p) => p.code)).toContain("chart.tooNarrow");
    expect(problems.every((p) => p.severity === "warning")).toBe(true);
  });

  it("warns when statusActions has no status column to click", () => {
    const problems = findViewProblems(
      view(
        [{ id: "t", x: 0, y: 0, w: 12, h: 3 }],
        [
          {
            id: "t",
            type: "table",
            dataBinding: { queryId: "overdueTasks", params: {} },
            config: { columns: [{ key: "title", label: "Task" }], statusActions: true },
          },
        ]
      )
    );
    expect(problems.map((p) => p.code)).toContain("table.statusActionsWithoutColumn");
  });
});
