import type { ViewInput } from "@/lib/dsl/schema";

// Graded expectations for the view-building agent.
//
// The security suite proves the agent can't do anything dangerous. Nothing
// proved it does anything *good* — so every system-prompt edit was a guess,
// and the prompt is now well over a thousand characters of accumulated
// behavioural rules. These cases pin the behaviour that matters: does a
// request produce a view at all, does it bind to the right query, does it
// pick a chart the data can actually support, and is the result laid out
// like something a person would keep.

export type EvalExpectation = {
  // The run must end by proposing a view rather than answering in prose.
  expectsView?: boolean;
  // The run must answer in text without building anything.
  expectsAnswerOnly?: boolean;
  // At least one widget must bind to one of these catalog ids.
  anyOfQueryIds?: string[];
  // Every one of these must appear somewhere in the view's bindings.
  allOfQueryIds?: string[];
  // Widget types the view must contain at least one of.
  widgetTypes?: string[];
  minWidgets?: number;
  maxWidgets?: number;
};

export type EvalCase = {
  id: string;
  prompt: string;
  // Set when the request is a refinement of an existing view.
  openView?: ViewInput;
  expect: EvalExpectation;
};

const simpleView: ViewInput = {
  name: "Overdue work",
  scope: "personal",
  layout: { widgets: [{ id: "table", x: 0, y: 0, w: 12, h: 4 }] },
  widgets: [
    {
      id: "table",
      type: "table",
      title: "Overdue",
      dataBinding: { queryId: "overdueTasks", params: {} },
      config: {
        columns: [
          { key: "title", label: "Task" },
          { key: "status", label: "Status", kind: "status" },
        ],
      },
    },
  ],
};

export const evalCases: EvalCase[] = [
  {
    id: "dashboard/delivery",
    prompt: "Build a delivery dashboard with velocity and overdue work",
    expect: {
      expectsView: true,
      anyOfQueryIds: ["velocityByWeek", "overdueTasks"],
      widgetTypes: ["chart"],
      minWidgets: 2,
    },
  },
  {
    id: "dashboard/executive",
    prompt:
      "Give me an executive overview: how much is open, how much is overdue, and where the work sits by project",
    expect: {
      expectsView: true,
      widgetTypes: ["kpi"],
      minWidgets: 3,
    },
  },
  {
    id: "chart/donut-shape",
    prompt: "Show me where remaining effort is concentrated as a donut by project",
    expect: {
      expectsView: true,
      anyOfQueryIds: ["pointsByProject", "openTasksByProject"],
      widgetTypes: ["chart"],
    },
  },
  {
    id: "chart/stacked-status",
    prompt: "Stacked bar of task status per project",
    expect: {
      expectsView: true,
      anyOfQueryIds: ["statusByProject"],
      widgetTypes: ["chart"],
    },
  },
  {
    id: "table/triage",
    prompt: "Give me a triage board of overdue work where I can change statuses inline",
    expect: {
      expectsView: true,
      anyOfQueryIds: ["overdueTasks", "tasksList"],
      widgetTypes: ["table"],
    },
  },
  {
    id: "kpi/single-number",
    prompt: "Just show me how many tasks are overdue, nothing else",
    expect: {
      expectsView: true,
      anyOfQueryIds: ["overdueTasks"],
      widgetTypes: ["kpi"],
      maxWidgets: 2,
    },
  },
  {
    id: "trend/cycle-time",
    prompt: "How has our cycle time trended over the last couple of months?",
    expect: {
      expectsView: true,
      anyOfQueryIds: ["cycleTimeByWeek"],
    },
  },
  {
    id: "question/most-behind",
    prompt: "Which project is most behind? Just tell me, don't build anything.",
    expect: { expectsAnswerOnly: true },
  },
  {
    id: "question/who-overloaded",
    prompt: "Who has the most overdue work right now? Answer in a sentence.",
    expect: { expectsAnswerOnly: true },
  },
  {
    id: "refine/add-widget",
    prompt: "Add a chart of completions over time above this table",
    openView: simpleView,
    expect: {
      expectsView: true,
      anyOfQueryIds: ["completionsOverTime", "createdVsCompleted"],
      widgetTypes: ["chart", "table"],
      minWidgets: 2,
    },
  },
  {
    id: "refine/keeps-existing",
    prompt: "Make the table taller",
    openView: simpleView,
    expect: {
      expectsView: true,
      // A refinement must carry existing widgets over rather than dropping
      // them — the most common way a follow-up quietly destroys work.
      allOfQueryIds: ["overdueTasks"],
      minWidgets: 1,
    },
  },
  {
    id: "impossible/unavailable-data",
    prompt: "Show me revenue per customer segment for last quarter",
    // Nothing in the catalog answers this. The right behaviour is to say so,
    // not to bind a task query to a revenue label.
    expect: { expectsAnswerOnly: true },
  },
];
