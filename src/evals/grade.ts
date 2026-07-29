import { parseView } from "@/lib/dsl/validate";
import { findViewProblems } from "@/lib/dsl/quality";
import type { EvalCase } from "./cases";

export type EvalOutcome = {
  // What the run actually did.
  proposedView: boolean;
  schema: unknown | null;
  text: string;
};

export type EvalResult = {
  caseId: string;
  passed: boolean;
  failures: string[];
  warnings: string[];
};

function bindingQueryIds(view: { widgets: unknown[] }): string[] {
  return view.widgets.flatMap((widget) => {
    const binding = (widget as { dataBinding?: { queryId?: string } }).dataBinding;
    return binding?.queryId ? [binding.queryId] : [];
  });
}

// Grades one run against its expectations. Deliberately does not score
// prose: whether an answer "reads well" is not something worth asserting on,
// and the things that break users — a view that never arrives, a chart bound
// to the wrong query, widgets stacked on top of each other — are all
// checkable.
export function gradeCase(evalCase: EvalCase, outcome: EvalOutcome): EvalResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const { expect: expectation } = evalCase;

  if (expectation.expectsAnswerOnly) {
    if (outcome.proposedView) {
      failures.push("built a view when the request asked for an answer");
    } else if (outcome.text.trim().length === 0) {
      failures.push("answered with no text at all");
    }
    return { caseId: evalCase.id, passed: failures.length === 0, failures, warnings };
  }

  if (expectation.expectsView && !outcome.proposedView) {
    failures.push("did not propose a view");
    return { caseId: evalCase.id, passed: false, failures, warnings };
  }

  const parsed = parseView(outcome.schema);
  if (!parsed.success) {
    failures.push(`proposed a view that fails schema validation: ${parsed.error}`);
    return { caseId: evalCase.id, passed: false, failures, warnings };
  }

  const view = parsed.data;

  // The same structural rules propose_view enforces — a view that reaches
  // here with errors means the tool let something through it shouldn't.
  for (const problem of findViewProblems(view)) {
    if (problem.severity === "error") failures.push(problem.message);
    else warnings.push(problem.message);
  }

  const queryIds = bindingQueryIds(view);
  const types = view.widgets.map((widget) => widget.type);

  if (expectation.anyOfQueryIds) {
    const hit = expectation.anyOfQueryIds.some((id) => queryIds.includes(id));
    if (!hit) {
      failures.push(
        `expected a binding to one of [${expectation.anyOfQueryIds.join(", ")}], got [${queryIds.join(", ") || "none"}]`
      );
    }
  }

  if (expectation.allOfQueryIds) {
    for (const id of expectation.allOfQueryIds) {
      if (!queryIds.includes(id)) {
        failures.push(`expected a binding to "${id}" to be carried over, got [${queryIds.join(", ") || "none"}]`);
      }
    }
  }

  if (expectation.widgetTypes) {
    for (const type of expectation.widgetTypes) {
      if (!types.includes(type as (typeof types)[number])) {
        failures.push(`expected at least one "${type}" widget, got [${types.join(", ")}]`);
      }
    }
  }

  if (expectation.minWidgets && view.widgets.length < expectation.minWidgets) {
    failures.push(`expected at least ${expectation.minWidgets} widgets, got ${view.widgets.length}`);
  }

  if (expectation.maxWidgets && view.widgets.length > expectation.maxWidgets) {
    failures.push(
      `expected at most ${expectation.maxWidgets} widgets, got ${view.widgets.length} — the request asked for something small`
    );
  }

  return { caseId: evalCase.id, passed: failures.length === 0, failures, warnings };
}

export function summarize(results: EvalResult[]) {
  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length === 0 ? 0 : Math.round((passed / results.length) * 100),
  };
}
