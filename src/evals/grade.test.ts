import { describe, expect, it } from "vitest";
import { evalCases } from "./cases";
import { gradeCase, summarize } from "./grade";
import type { EvalCase } from "./cases";
import type { ViewInput } from "@/lib/dsl/schema";

// The offline half of the eval harness. Running the real agent costs tokens
// and needs a key, so that half is opt-in (npm run evals); this half checks
// the grader itself on every commit — a grader that silently passes
// everything is worse than no grader, because it reads as a green check.

const goodDeliveryView: ViewInput = {
  name: "Delivery",
  scope: "personal",
  layout: {
    widgets: [
      { id: "velocity", x: 0, y: 0, w: 12, h: 3 },
      { id: "overdue", x: 0, y: 3, w: 12, h: 3 },
    ],
  },
  widgets: [
    {
      id: "velocity",
      type: "chart",
      dataBinding: { queryId: "velocityByWeek", params: {} },
      config: { chartType: "line", xField: "week", yField: "points" },
    },
    {
      id: "overdue",
      type: "table",
      dataBinding: { queryId: "overdueTasks", params: {} },
      config: { columns: [{ key: "title", label: "Task" }] },
    },
  ],
};

const deliveryCase = evalCases.find((c) => c.id === "dashboard/delivery")!;
const questionCase = evalCases.find((c) => c.id === "question/most-behind")!;

describe("eval grading", () => {
  it("passes a view that meets its expectations", () => {
    const result = gradeCase(deliveryCase, {
      proposedView: true,
      schema: goodDeliveryView,
      text: "",
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails when no view was produced for a build request", () => {
    const result = gradeCase(deliveryCase, { proposedView: false, schema: null, text: "here you go" });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toMatch(/did not propose a view/);
  });

  it("fails when the view binds to the wrong queries", () => {
    const wrong: ViewInput = {
      ...goodDeliveryView,
      widgets: goodDeliveryView.widgets.map((widget) =>
        widget.id === "velocity"
          ? {
              ...widget,
              dataBinding: { queryId: "tasksByPriorityCount", params: {} },
            }
          : { ...widget, dataBinding: { queryId: "tasksList", params: {} } }
      ) as ViewInput["widgets"],
    };

    const result = gradeCase(deliveryCase, { proposedView: true, schema: wrong, text: "" });
    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toMatch(/expected a binding to one of/);
  });

  it("fails a structurally broken view even when the bindings are right", () => {
    const overlapping: ViewInput = {
      ...goodDeliveryView,
      layout: {
        widgets: [
          { id: "velocity", x: 0, y: 0, w: 12, h: 3 },
          { id: "overdue", x: 0, y: 1, w: 12, h: 3 },
        ],
      },
    };
    const result = gradeCase(deliveryCase, {
      proposedView: true,
      schema: overlapping,
      text: "",
    });
    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toMatch(/same grid cells/);
  });

  it("fails a view that doesn't survive schema validation", () => {
    const result = gradeCase(deliveryCase, {
      proposedView: true,
      schema: { name: "nope" },
      text: "",
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toMatch(/schema validation/);
  });

  it("passes a text answer for a question, and fails a view", () => {
    expect(
      gradeCase(questionCase, {
        proposedView: false,
        schema: null,
        text: "Website Relaunch is furthest behind, with 6 overdue tasks.",
      }).passed
    ).toBe(true);

    const forced = gradeCase(questionCase, {
      proposedView: true,
      schema: goodDeliveryView,
      text: "",
    });
    expect(forced.passed).toBe(false);
    expect(forced.failures[0]).toMatch(/asked for an answer/);
  });

  it("fails an empty answer to a question", () => {
    const result = gradeCase(questionCase, { proposedView: false, schema: null, text: "   " });
    expect(result.passed).toBe(false);
  });

  it("enforces maxWidgets so 'just one number' doesn't return a dashboard", () => {
    const small = evalCases.find((c) => c.id === "kpi/single-number")!;
    const result = gradeCase(small, { proposedView: true, schema: goodDeliveryView, text: "" });
    expect(result.passed).toBe(false);
  });

  it("summarizes a mixed run", () => {
    const summary = summarize([
      { caseId: "a", passed: true, failures: [], warnings: [] },
      { caseId: "b", passed: false, failures: ["nope"], warnings: [] },
      { caseId: "c", passed: true, failures: [], warnings: [] },
      { caseId: "d", passed: true, failures: [], warnings: [] },
    ]);
    expect(summary).toEqual({ total: 4, passed: 3, failed: 1, passRate: 75 });
  });
});

describe("eval cases", () => {
  it("has unique ids and a usable expectation on every case", () => {
    const ids = evalCases.map((c: EvalCase) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const evalCase of evalCases) {
      const { expect: expectation } = evalCase;
      const hasSomething =
        expectation.expectsView ||
        expectation.expectsAnswerOnly ||
        expectation.anyOfQueryIds ||
        expectation.allOfQueryIds ||
        expectation.widgetTypes;
      expect(hasSomething, `${evalCase.id} asserts nothing`).toBeTruthy();
    }
  });

  it("covers both build and answer behaviour", () => {
    expect(evalCases.some((c) => c.expect.expectsView)).toBe(true);
    expect(evalCases.some((c) => c.expect.expectsAnswerOnly)).toBe(true);
    expect(evalCases.some((c) => c.openView)).toBe(true);
  });
});
