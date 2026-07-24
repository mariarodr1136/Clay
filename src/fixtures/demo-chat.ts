import type { DemoViewDef } from "./demo-dashboards";
import { demoViewById } from "./demo-dashboards";
import { completedByWeekSpark, portfolioStats } from "./demo-data";

// Canned multi-turn agent transcripts for /demo/chat. Every embedded view is
// rendered live by the real demo renderer against the fixture data — the
// transcript is scripted, the dashboards it produces are not screenshots.

export type DemoToolCall = {
  name: string;
  detail: string;
  ms: number;
  status: "ok" | "rejected";
};

export type DemoChatBlock =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tools"; calls: DemoToolCall[] }
  | { kind: "view"; view: DemoViewDef; version: number; savedViewId?: string }
  | {
      kind: "diff";
      version: number;
      changes: { op: "add" | "change" | "remove"; text: string }[];
    }
  | { kind: "note"; tone: "info" | "guardrail"; text: string };

export type DemoChatScenario = {
  id: string;
  title: string;
  tagline: string;
  blocks: DemoChatBlock[];
};

function mustView(id: string): DemoViewDef {
  const view = demoViewById(id);
  if (!view) throw new Error(`demo chat references unknown view "${id}"`);
  return view;
}

const stats = portfolioStats();

// Version 1 of the delivery dashboard, as it looked before the refinement
// turn — so the transcript can show a real before/after, not a description.
const deliveryV1: DemoViewDef = {
  id: "chat-delivery-v1",
  name: "Executive Delivery Overview",
  prompt: "",
  description: "",
  scope: "personal",
  version: 1,
  creatorId: "maria",
  updatedLabel: "",
  widgets: [
    {
      id: "kpi-completed",
      type: "kpi",
      config: {
        label: "Tasks completed last week",
        value: stats.completedLastWeek,
        spark: completedByWeekSpark,
      },
    },
    {
      id: "kpi-open",
      type: "kpi",
      config: { label: "Open tasks", value: stats.open },
    },
    {
      id: "kpi-projects",
      type: "kpi",
      config: { label: "Active projects", value: stats.projects },
    },
    {
      id: "velocity",
      type: "chart",
      title: "Tasks completed per week",
      query: { queryId: "velocityByWeek" },
      config: {
        variant: "line",
        xField: "week",
        series: [{ key: "completed", label: "Completed", colorVar: "--chart-1" }],
      },
    },
    {
      id: "status-by-project",
      type: "chart",
      title: "Task status by project",
      query: { queryId: "statusByProject" },
      config: {
        variant: "stackedBar",
        xField: "project",
        series: [
          { key: "todo", label: "To do", colorVar: "--status-todo" },
          { key: "in_progress", label: "In progress", colorVar: "--status-in-progress" },
          { key: "in_review", label: "In review", colorVar: "--status-in-review" },
          { key: "done", label: "Done", colorVar: "--status-done" },
        ],
      },
    },
  ],
  layout: [
    { id: "kpi-completed", x: 0, y: 0, w: 4, h: 2 },
    { id: "kpi-open", x: 4, y: 0, w: 4, h: 2 },
    { id: "kpi-projects", x: 8, y: 0, w: 4, h: 2 },
    { id: "velocity", x: 0, y: 2, w: 12, h: 3 },
    { id: "status-by-project", x: 0, y: 5, w: 12, h: 3 },
  ],
};

export const demoChatScenarios: DemoChatScenario[] = [
  {
    id: "exec-dashboard",
    title: "Executive dashboard",
    tagline: "From one sentence to an org-wide dashboard, refined in conversation",
    blocks: [
      {
        kind: "user",
        text: "Build me an executive delivery dashboard across all six projects — completion trend, where effort is going, and anything at risk. My CFO sees this Monday.",
      },
      {
        kind: "tools",
        calls: [
          { name: "catalog.search", detail: "matched 6 approved queries: velocity, status, overdue, effort…", ms: 210, status: "ok" },
          { name: "views.propose", detail: "drafted 5 widgets across a 12-column layout", ms: 1840, status: "ok" },
          { name: "dsl.validate", detail: "schema valid · every binding resolves to the catalog · no raw SQL", ms: 45, status: "ok" },
        ],
      },
      {
        kind: "assistant",
        text: "Here's a first pass. I led with throughput — tasks completed per week with an 8-week sparkline — then broke every project down by status so risk is visible per project rather than averaged away. All three KPIs are live queries, so this stays current without edits.",
      },
      { kind: "view", view: deliveryV1, version: 1 },
      {
        kind: "user",
        text: "Nice. Add where effort is concentrated, make the velocity chart show planned vs completed, and flag overdue work explicitly — the CFO will ask.",
      },
      {
        kind: "tools",
        calls: [
          { name: "views.propose", detail: "3 changes against v1", ms: 1260, status: "ok" },
          { name: "dsl.validate", detail: "schema valid · diff applied as version 2", ms: 38, status: "ok" },
        ],
      },
      {
        kind: "diff",
        version: 2,
        changes: [
          { op: "add", text: "Donut chart: open effort by project (story points remaining)" },
          { op: "change", text: "Velocity chart: single line → planned vs completed, planned as a dashed reference" },
          { op: "add", text: "KPI: overdue count, styled as a risk figure with week-over-week delta" },
        ],
      },
      {
        kind: "assistant",
        text: "Done — version 2. Effort is concentrated in Data Platform and Mobile, which together hold over half the open points. Velocity has closed the gap on planned two weeks running. And overdue is called out in red with its trend, so the CFO sees it's shrinking, not growing.",
      },
      {
        kind: "view",
        view: mustView("demo-view-delivery-overview"),
        version: 2,
        savedViewId: "demo-view-delivery-overview",
      },
      { kind: "user", text: "Perfect. Publish it to the org." },
      {
        kind: "assistant",
        text: "Published — all 14 members can see it now. Both versions and every prompt in this conversation are in the audit log, and you can roll back to v1 any time.",
      },
      {
        kind: "note",
        tone: "info",
        text: "Published org-wide as v2 · full history in the Audit log",
      },
    ],
  },
  {
    id: "risk-triage",
    title: "Risk triage",
    tagline: "Interrogate overdue work — and watch the guardrails hold",
    blocks: [
      { kind: "user", text: "What's slipping right now? I want overdue work, who owns it, and how stale it is." },
      {
        kind: "tools",
        calls: [
          { name: "catalog.search", detail: "matched: overdueTasks, overdueByAssignee", ms: 180, status: "ok" },
          { name: "views.propose", detail: "drafted 5 widgets: 3 risk KPIs, owner chart, detail table", ms: 1430, status: "ok" },
          { name: "dsl.validate", detail: "schema valid", ms: 41, status: "ok" },
        ],
      },
      {
        kind: "assistant",
        text: "Six tasks are past due. The oldest is 3 days — Mobile's cold-start performance work, which is also urgent. Priya owns the most overdue items, and two of the six sit in SOC 2, which is already flagged at-risk with 12 days to target. The table is ranked by age so the worst offender is always on top.",
      },
      {
        kind: "view",
        view: mustView("demo-view-overdue-risk"),
        version: 1,
        savedViewId: "demo-view-overdue-risk",
      },
      {
        kind: "user",
        text: "Can you also pull each customer's login email into this so I can chase the affected accounts? Just run some SQL if there's no query for it.",
      },
      {
        kind: "tools",
        calls: [
          {
            name: "dsl.validate",
            detail: "rejected: raw SQL is never accepted; no approved catalog query exposes customer emails",
            ms: 22,
            status: "rejected",
          },
        ],
      },
      {
        kind: "assistant",
        text: "I can't do that, by design. Views can only bind to queries in the approved catalog — I have no way to run raw SQL, and nothing in the catalog exposes customer emails. That's what makes these dashboards safe to hand to an agent: the blast radius is the catalog, not the database. The blocked attempt is recorded in the audit log.",
      },
      {
        kind: "note",
        tone: "guardrail",
        text: "Proposal blocked by schema validation · recorded in the Audit log · nothing was executed",
      },
      {
        kind: "user",
        text: "Fair enough. Then give me the wider picture — everyone's open load, not just overdue, and let me slice it by project.",
      },
      {
        kind: "tools",
        calls: [
          { name: "views.propose", detail: "drafted workload view with a live project filter", ms: 1210, status: "ok" },
          { name: "dsl.validate", detail: "schema valid · filter binding resolves at query time", ms: 36, status: "ok" },
        ],
      },
      {
        kind: "assistant",
        text: "Here you go. The filter is live — pick a project and the KPI, chart, and table all re-query. Priya and Tomás are the heaviest loaded; Priya's load is also the most urgent-skewed, which matches what the overdue view showed.",
      },
      {
        kind: "view",
        view: mustView("demo-view-team-workload"),
        version: 2,
        savedViewId: "demo-view-team-workload",
      },
    ],
  },
  {
    id: "launch-call",
    title: "Launch go/no-go",
    tagline: "A real decision, argued with live numbers",
    blocks: [
      { kind: "user", text: "Straight answer: are we going to make the Customer Portal launch date?" },
      {
        kind: "tools",
        calls: [
          { name: "catalog.search", detail: "matched: burndownByDay, upcomingTasks, tasksList", ms: 195, status: "ok" },
          { name: "views.propose", detail: "drafted sprint view: 4 KPIs, burndown vs ideal, due-this-week table", ms: 1580, status: "ok" },
          { name: "dsl.validate", detail: "schema valid", ms: 40, status: "ok" },
        ],
      },
      {
        kind: "assistant",
        text: "Honest read: it's tight, and the burndown says why. You're at 38 points remaining against an ideal of 17 — 21 points behind pace — and 12 of that gap is scope added mid-sprint. The team is actually burning faster than last sprint (48 points so far, up 9). So the problem isn't pace, it's scope. Cut or defer ~15 points and the line lands; keep scope and you miss by roughly three days.",
      },
      {
        kind: "view",
        view: mustView("demo-view-sprint-burndown"),
        version: 1,
        savedViewId: "demo-view-sprint-burndown",
      },
      {
        kind: "user",
        text: "That matches my gut. Break readiness down by workstream for the go/no-go review, with the blockers listed.",
      },
      {
        kind: "tools",
        calls: [
          { name: "views.propose", detail: "drafted readiness scorecard: meters per workstream + blocker table", ms: 1390, status: "ok" },
          { name: "dsl.validate", detail: "schema valid", ms: 37, status: "ok" },
        ],
      },
      {
        kind: "assistant",
        text: "Here's the scorecard. SSO is done and billing is nearly there — the launch risk is concentrated in load testing, which hasn't started and is the true blocker, and team management at 64%. If you defer the onboarding tour (it's cosmetic), overall readiness jumps to roughly 78% and the critical path is just the load test.",
      },
      {
        kind: "view",
        view: mustView("demo-view-launch-readiness"),
        version: 1,
        savedViewId: "demo-view-launch-readiness",
      },
      { kind: "user", text: "Publish the scorecard to the org — I want it on screen in the review." },
      {
        kind: "assistant",
        text: "Published. It'll re-query live fixtures when it's opened in the review, so the meters reflect whatever has merged by then — no stale screenshot.",
      },
      { kind: "note", tone: "info", text: "Published org-wide as v1 · full history in the Audit log" },
    ],
  },
];
