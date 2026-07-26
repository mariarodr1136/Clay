import { demoProjects, portfolioStats, completedByWeekSpark, cycleTimeByWeek } from "./demo-data";

// Rich, hand-authored dashboard fixtures for /demo. These use a demo-only
// superset of the live DSL (extra chart variants, KPI deltas/sparklines,
// progress meters) so the demo can show where the product is headed, while
// the live agent pipeline stays on the validated schema in lib/dsl.

export type DemoQueryBinding = {
  queryId: string;
  params?: Record<string, string | number | boolean | null>;
};

export type DemoSeries = {
  key: string;
  label: string;
  colorVar?: string;
  dashed?: boolean;
};

export type DemoColumnKind = "text" | "status" | "priority" | "person" | "date" | "number" | "tags";

export type DemoColumn = {
  key: string;
  label: string;
  kind?: DemoColumnKind;
};

export type DemoKpiConfig = {
  label: string;
  // Either a literal value, or an aggregate over the bound query's rows.
  value?: string | number;
  aggregate?: "count" | "sum";
  field?: string;
  format?: "number" | "percent" | "points" | "days";
  intent?: "default" | "danger";
  // A non-directional caption line; use delta when the figure moved vs a period.
  note?: string;
  delta?: { value: string; direction: "up" | "down"; positive: boolean; caption: string };
  spark?: { x: string; y: number }[];
};

export type DemoWidget =
  | { id: string; type: "kpi"; title?: string; query?: DemoQueryBinding; config: DemoKpiConfig }
  | {
      id: string;
      type: "chart";
      title?: string;
      description?: string;
      query: DemoQueryBinding;
      config: {
        variant: "bar" | "stackedBar" | "line" | "area" | "stackedArea" | "donut";
        xField?: string;
        series?: DemoSeries[];
        donut?: { nameField: string; valueField: string; centerLabel: string; maxSlices?: number };
      };
    }
  | {
      id: string;
      type: "table";
      title?: string;
      query: DemoQueryBinding;
      // statusActions mirrors the live DSL flag: status cells render as
      // dropdowns. Demo data is read-only, so changing one explains itself
      // with a toast instead of writing.
      config: { columns: DemoColumn[]; statusActions?: boolean };
    }
  | {
      id: string;
      type: "filterBar";
      config: {
        filterKey: string;
        label: string;
        options: { label: string; value: string }[];
      };
    }
  | { id: string; type: "text"; title?: string; config: { content: string } }
  | {
      id: string;
      type: "progress";
      title?: string;
      query: DemoQueryBinding;
      config: { nameField: string; valueField: string };
    };

export type DemoLayoutItem = { id: string; x: number; y: number; w: number; h: number };

export type DemoViewDef = {
  id: string;
  name: string;
  prompt: string;
  description: string;
  scope: "personal" | "org";
  version: number;
  creatorId: string;
  updatedLabel: string;
  widgets: DemoWidget[];
  layout: DemoLayoutItem[];
};

const stats = portfolioStats();

const statusSeries: DemoSeries[] = [
  { key: "todo", label: "To do", colorVar: "--status-todo" },
  { key: "in_progress", label: "In progress", colorVar: "--status-in-progress" },
  { key: "in_review", label: "In review", colorVar: "--status-in-review" },
];

const projectFilterOptions = demoProjects.map((p) => ({ label: p.shortName, value: p.id }));

export const demoViewDefs: DemoViewDef[] = [
  {
    id: "demo-view-delivery-overview",
    name: "Executive Delivery Overview",
    prompt:
      "Build me an executive delivery dashboard across all six projects — completion trend, where effort is going, and anything at risk.",
    description: "Org-wide delivery health: throughput, effort concentration, and per-project status.",
    scope: "org",
    version: 2,
    creatorId: "maria",
    updatedLabel: "12 min ago",
    widgets: [
      {
        id: "kpi-completed",
        type: "kpi",
        config: {
          label: "Tasks completed last week",
          value: stats.completedLastWeek,
          delta: {
            value: `+${stats.velocityDelta}`,
            direction: "up",
            positive: true,
            caption: "vs prior week",
          },
          spark: completedByWeekSpark,
        },
      },
      {
        id: "kpi-ontime",
        type: "kpi",
        config: {
          label: "On-time delivery",
          value: "87%",
          delta: { value: "+4 pts", direction: "up", positive: true, caption: "vs June" },
        },
      },
      {
        id: "kpi-open",
        type: "kpi",
        config: {
          label: "Open tasks",
          value: stats.open,
          note: `${stats.inFlight} in flight across 6 projects`,
        },
      },
      {
        id: "kpi-overdue",
        type: "kpi",
        query: { queryId: "overdueTasks", params: { limit: 200 } },
        config: {
          label: "Overdue",
          aggregate: "count",
          intent: "danger",
          delta: { value: "-2", direction: "down", positive: true, caption: "vs last Monday" },
        },
      },
      {
        id: "velocity",
        type: "chart",
        title: "Velocity — planned vs completed",
        description: "Story points per week, all projects",
        query: { queryId: "velocityByWeek" },
        config: {
          variant: "line",
          xField: "week",
          series: [
            { key: "completed", label: "Completed", colorVar: "--chart-1" },
            { key: "planned", label: "Planned", colorVar: "--muted-foreground", dashed: true },
          ],
        },
      },
      {
        id: "effort",
        type: "chart",
        title: "Open effort by project",
        description: "Story points remaining",
        query: { queryId: "pointsByProject" },
        config: {
          variant: "donut",
          donut: { nameField: "project", valueField: "points", centerLabel: "pts open" },
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
          series: [...statusSeries, { key: "done", label: "Done", colorVar: "--status-done" }],
        },
      },
    ],
    layout: [
      { id: "kpi-completed", x: 0, y: 0, w: 3, h: 2 },
      { id: "kpi-ontime", x: 3, y: 0, w: 3, h: 2 },
      { id: "kpi-open", x: 6, y: 0, w: 3, h: 2 },
      { id: "kpi-overdue", x: 9, y: 0, w: 3, h: 2 },
      { id: "velocity", x: 0, y: 2, w: 7, h: 3 },
      { id: "effort", x: 7, y: 2, w: 5, h: 3 },
      { id: "status-by-project", x: 0, y: 5, w: 12, h: 3 },
    ],
  },
  {
    id: "demo-view-sprint-burndown",
    name: "Portal Launch Sprint",
    prompt: "Show the current Portal sprint burndown against ideal pace, and what's due this week.",
    description: "Sprint 24 burndown with ideal pace and this week's due list for Customer Portal.",
    scope: "personal",
    version: 1,
    creatorId: "priya",
    updatedLabel: "Yesterday",
    widgets: [
      {
        id: "kpi-remaining",
        type: "kpi",
        config: {
          label: "Points remaining",
          value: 38,
          format: "points",
          delta: { value: "21 behind ideal", direction: "up", positive: false, caption: "pace to date" },
        },
      },
      {
        id: "kpi-days",
        type: "kpi",
        config: { label: "Working days left", value: 6 },
      },
      {
        id: "kpi-scope",
        type: "kpi",
        config: {
          label: "Scope added mid-sprint",
          value: "+12 pts",
          delta: { value: "3 tasks", direction: "up", positive: false, caption: "since Jul 14" },
        },
      },
      {
        id: "kpi-burned",
        type: "kpi",
        config: {
          label: "Completed this sprint",
          value: "48 pts",
          delta: { value: "+9", direction: "up", positive: true, caption: "vs sprint 23" },
        },
      },
      {
        id: "burndown",
        type: "chart",
        title: "Burndown — sprint 24",
        description: "Points remaining vs ideal pace",
        query: { queryId: "burndownByDay" },
        config: {
          variant: "area",
          xField: "day",
          series: [
            { key: "remaining", label: "Remaining", colorVar: "--chart-1" },
            { key: "ideal", label: "Ideal pace", colorVar: "--muted-foreground", dashed: true },
          ],
        },
      },
      {
        id: "due-this-week",
        type: "table",
        title: "Due in the next 7 days — Portal",
        query: { queryId: "upcomingTasks", params: { projectId: "demo-project-portal", days: 7 } },
        config: {
          columns: [
            { key: "title", label: "Task" },
            { key: "assignee", label: "Owner", kind: "person" },
            { key: "priority", label: "Priority", kind: "priority" },
            { key: "dueDate", label: "Due", kind: "date" },
          ],
        },
      },
    ],
    layout: [
      { id: "kpi-remaining", x: 0, y: 0, w: 3, h: 2 },
      { id: "kpi-days", x: 3, y: 0, w: 3, h: 2 },
      { id: "kpi-scope", x: 6, y: 0, w: 3, h: 2 },
      { id: "kpi-burned", x: 9, y: 0, w: 3, h: 2 },
      { id: "burndown", x: 0, y: 2, w: 12, h: 3 },
      { id: "due-this-week", x: 0, y: 5, w: 12, h: 3 },
    ],
  },
  {
    id: "demo-view-overdue-risk",
    name: "Overdue & At Risk",
    prompt: "Which tasks are overdue, who owns them, and how bad is it?",
    description: "Everything past due across the portfolio, ranked by age, with owner concentration.",
    scope: "personal",
    version: 1,
    creatorId: "maria",
    updatedLabel: "3 hr ago",
    widgets: [
      {
        id: "kpi-overdue-count",
        type: "kpi",
        query: { queryId: "overdueTasks", params: { limit: 200 } },
        config: { label: "Overdue tasks", aggregate: "count", intent: "danger" },
      },
      {
        id: "kpi-oldest",
        type: "kpi",
        config: { label: "Oldest overdue", value: "3 days", intent: "danger" },
      },
      {
        id: "kpi-urgent",
        type: "kpi",
        query: { queryId: "overdueTasks", params: { priority: "urgent", limit: 200 } },
        config: { label: "Overdue & urgent", aggregate: "count", intent: "danger" },
      },
      {
        id: "overdue-by-owner",
        type: "chart",
        title: "Overdue by owner",
        query: { queryId: "overdueByAssignee" },
        config: {
          variant: "bar",
          xField: "assignee",
          series: [{ key: "count", label: "Overdue", colorVar: "--priority-urgent" }],
        },
      },
      {
        id: "overdue-table",
        type: "table",
        title: "Overdue tasks",
        query: { queryId: "overdueTasks", params: { limit: 20 } },
        config: {
          columns: [
            { key: "title", label: "Task" },
            { key: "project", label: "Project" },
            { key: "assignee", label: "Owner", kind: "person" },
            { key: "priority", label: "Priority", kind: "priority" },
            { key: "daysOverdue", label: "Days over", kind: "number" },
          ],
        },
      },
    ],
    layout: [
      { id: "kpi-overdue-count", x: 0, y: 0, w: 4, h: 2 },
      { id: "kpi-oldest", x: 4, y: 0, w: 4, h: 2 },
      { id: "kpi-urgent", x: 8, y: 0, w: 4, h: 2 },
      { id: "overdue-by-owner", x: 0, y: 2, w: 5, h: 3 },
      { id: "overdue-table", x: 5, y: 2, w: 7, h: 3 },
    ],
  },
  {
    id: "demo-view-team-workload",
    name: "Team Workload",
    prompt: "Give me a filterable view of open work by assignee, broken down by status.",
    description: "Who is carrying what, filterable by project — spot overload before it slips.",
    scope: "org",
    version: 2,
    creatorId: "maria",
    updatedLabel: "2 hr ago",
    widgets: [
      {
        id: "project-filter",
        type: "filterBar",
        config: { filterKey: "project", label: "Project", options: projectFilterOptions },
      },
      {
        id: "kpi-open-filtered",
        type: "kpi",
        query: { queryId: "openByAssignee", params: { projectId: "$filter:project" } },
        config: { label: "Open tasks in view", aggregate: "sum", field: "total" },
      },
      {
        id: "workload",
        type: "chart",
        title: "Open work by assignee",
        query: { queryId: "openByAssignee", params: { projectId: "$filter:project" } },
        config: { variant: "stackedBar", xField: "assignee", series: statusSeries },
      },
      {
        id: "workload-table",
        type: "table",
        title: "Open tasks",
        query: {
          queryId: "tasksList",
          params: { projectId: "$filter:project", open: true, limit: 50 },
        },
        config: {
          statusActions: true,
          columns: [
            { key: "title", label: "Task" },
            { key: "project", label: "Project" },
            { key: "assignee", label: "Owner", kind: "person" },
            { key: "status", label: "Status", kind: "status" },
            { key: "priority", label: "Priority", kind: "priority" },
          ],
        },
      },
    ],
    layout: [
      { id: "project-filter", x: 0, y: 0, w: 12, h: 1 },
      { id: "kpi-open-filtered", x: 0, y: 1, w: 3, h: 2 },
      { id: "workload", x: 3, y: 1, w: 9, h: 3 },
      { id: "workload-table", x: 0, y: 4, w: 12, h: 3 },
    ],
  },
  {
    id: "demo-view-cycle-time",
    name: "Cycle Time Trends",
    prompt: "How has our cycle time trended since June? Break it down by stage.",
    description: "Average days a task spends in progress and in review, week over week.",
    scope: "personal",
    version: 1,
    creatorId: "aisha",
    updatedLabel: "Yesterday",
    widgets: [
      {
        id: "kpi-cycle",
        type: "kpi",
        config: {
          label: "Avg cycle time",
          value: "4.0 days",
          delta: { value: "-3.4 days", direction: "down", positive: true, caption: "vs first week of June" },
          spark: cycleTimeByWeek.map((w) => ({ x: w.week, y: +(w.inProgress + w.inReview).toFixed(1) })),
        },
      },
      {
        id: "kpi-review",
        type: "kpi",
        config: {
          label: "Avg time in review",
          value: "1.3 days",
          delta: { value: "-54%", direction: "down", positive: true, caption: "since June" },
        },
      },
      {
        id: "cycle-chart",
        type: "chart",
        title: "Cycle time by stage",
        description: "Average days per completed task",
        query: { queryId: "cycleTimeByWeek" },
        config: {
          variant: "stackedArea",
          xField: "week",
          series: [
            { key: "inProgress", label: "In progress", colorVar: "--chart-1" },
            { key: "inReview", label: "In review", colorVar: "--chart-2" },
          ],
        },
      },
      {
        id: "cycle-note",
        type: "text",
        config: {
          content:
            "Cycle time is down 46% since the first week of June. Most of the gain is in review: smaller pull requests and a rotating review owner cut average review time from 2.8 to 1.3 days.",
        },
      },
    ],
    layout: [
      { id: "kpi-cycle", x: 0, y: 0, w: 3, h: 2 },
      { id: "kpi-review", x: 0, y: 2, w: 3, h: 2 },
      { id: "cycle-chart", x: 3, y: 0, w: 9, h: 4 },
      { id: "cycle-note", x: 0, y: 4, w: 12, h: 1 },
    ],
  },
  {
    id: "demo-view-upcoming-week",
    name: "Next 7 Days",
    prompt: "What's due in the next 7 days across all projects? Let me filter by priority.",
    description: "The coming week's deadlines in one list, filterable by priority.",
    scope: "personal",
    version: 1,
    creatorId: "nina",
    updatedLabel: "2 days ago",
    widgets: [
      {
        id: "priority-filter",
        type: "filterBar",
        config: {
          filterKey: "priority",
          label: "Priority",
          options: [
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
            { label: "Urgent", value: "urgent" },
          ],
        },
      },
      {
        id: "kpi-due",
        type: "kpi",
        query: { queryId: "upcomingTasks", params: { days: 7, priority: "$filter:priority" } },
        config: { label: "Due in 7 days", aggregate: "count" },
      },
      {
        id: "kpi-review-now",
        type: "kpi",
        query: { queryId: "tasksList", params: { status: "in_review", limit: 200 } },
        config: { label: "Waiting on review", aggregate: "count" },
      },
      {
        id: "kpi-overdue-now",
        type: "kpi",
        query: { queryId: "overdueTasks", params: { limit: 200 } },
        config: { label: "Already overdue", aggregate: "count", intent: "danger" },
      },
      {
        id: "upcoming-table",
        type: "table",
        title: "Due soon",
        query: { queryId: "upcomingTasks", params: { days: 7, priority: "$filter:priority", limit: 30 } },
        config: {
          columns: [
            { key: "title", label: "Task" },
            { key: "project", label: "Project" },
            { key: "assignee", label: "Owner", kind: "person" },
            { key: "priority", label: "Priority", kind: "priority" },
            { key: "dueDate", label: "Due", kind: "date" },
          ],
        },
      },
    ],
    layout: [
      { id: "priority-filter", x: 0, y: 0, w: 12, h: 1 },
      { id: "kpi-due", x: 0, y: 1, w: 4, h: 2 },
      { id: "kpi-review-now", x: 4, y: 1, w: 4, h: 2 },
      { id: "kpi-overdue-now", x: 8, y: 1, w: 4, h: 2 },
      { id: "upcoming-table", x: 0, y: 3, w: 12, h: 4 },
    ],
  },
  {
    id: "demo-view-launch-readiness",
    name: "Portal Launch Readiness",
    prompt: "Are we ready for the Customer Portal launch? Score readiness by workstream and list blockers.",
    description: "Workstream-by-workstream readiness score for the Portal GA date.",
    scope: "org",
    version: 1,
    creatorId: "priya",
    updatedLabel: "Yesterday",
    widgets: [
      {
        id: "readiness-summary",
        type: "text",
        config: {
          content:
            "Overall readiness is 69%. SSO and billing are launch-ready. Load testing is the critical path — it hasn't started and blocks the go/no-go call. Team management UI needs 2 more weeks at current pace.",
        },
      },
      {
        id: "kpi-readiness",
        type: "kpi",
        config: {
          label: "Overall readiness",
          value: "69%",
          delta: { value: "+11 pts", direction: "up", positive: true, caption: "vs last review" },
        },
      },
      {
        id: "kpi-blockers",
        type: "kpi",
        config: { label: "Launch blockers", value: 2, intent: "danger" },
      },
      {
        id: "readiness-meters",
        type: "progress",
        title: "Readiness by workstream",
        query: { queryId: "launchReadiness" },
        config: { nameField: "workstream", valueField: "percent" },
      },
      {
        id: "blocker-table",
        type: "table",
        title: "Open Portal work",
        query: { queryId: "tasksList", params: { projectId: "demo-project-portal", status: "todo" } },
        config: {
          columns: [
            { key: "title", label: "Task" },
            { key: "assignee", label: "Owner", kind: "person" },
            { key: "priority", label: "Priority", kind: "priority" },
            { key: "dueDate", label: "Due", kind: "date" },
          ],
        },
      },
    ],
    layout: [
      { id: "readiness-summary", x: 0, y: 0, w: 8, h: 1 },
      { id: "readiness-meters", x: 0, y: 1, w: 8, h: 3 },
      { id: "kpi-readiness", x: 8, y: 0, w: 4, h: 2 },
      { id: "kpi-blockers", x: 8, y: 2, w: 4, h: 2 },
      { id: "blocker-table", x: 0, y: 4, w: 12, h: 3 },
    ],
  },
  {
    id: "demo-view-tasks-by-status",
    name: "Tasks by Status",
    prompt: "Show me tasks by status as a bar chart",
    description: "The first view ever generated in this workspace — a simple status breakdown.",
    scope: "personal",
    version: 2,
    creatorId: "maria",
    updatedLabel: "2 weeks ago",
    widgets: [
      {
        id: "total",
        type: "kpi",
        query: { queryId: "tasksList", params: { limit: 200 } },
        config: { label: "Total tasks", aggregate: "count" },
      },
      {
        id: "statusChart",
        type: "chart",
        title: "By status",
        query: { queryId: "tasksByStatusCount" },
        config: {
          variant: "bar",
          xField: "status",
          series: [{ key: "count", label: "Tasks", colorVar: "--chart-1" }],
        },
      },
    ],
    layout: [
      { id: "total", x: 0, y: 0, w: 3, h: 2 },
      { id: "statusChart", x: 3, y: 0, w: 9, h: 3 },
    ],
  },
];

const viewsById = new Map(demoViewDefs.map((v) => [v.id, v]));

export function demoViewById(id: string): DemoViewDef | undefined {
  return viewsById.get(id);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type DemoAuditAction = "created" | "refined" | "published" | "rolled_back" | "rejected";

export type DemoAuditEntry = {
  id: string;
  action: DemoAuditAction;
  viewId?: string;
  viewName: string;
  actorType: "agent" | "user";
  personId: string;
  version?: number;
  prompt?: string;
  detail?: string;
  diff?: string[];
  timeLabel: string;
  group: "Today" | "Yesterday" | "Earlier this week" | "Older";
};

export const auditActionMeta: Record<DemoAuditAction, { label: string; colorVar: string }> = {
  created: { label: "Created", colorVar: "--status-in-progress" },
  refined: { label: "Refined", colorVar: "--status-in-review" },
  published: { label: "Published", colorVar: "--status-done" },
  rolled_back: { label: "Rolled back", colorVar: "--priority-high" },
  rejected: { label: "Blocked", colorVar: "--priority-urgent" },
};

export const demoAuditLog: DemoAuditEntry[] = [
  {
    id: "audit-1",
    action: "published",
    viewId: "demo-view-delivery-overview",
    viewName: "Executive Delivery Overview",
    actorType: "user",
    personId: "maria",
    version: 2,
    detail: "Published to the whole org. Now visible to 14 members.",
    timeLabel: "12 min ago",
    group: "Today",
  },
  {
    id: "audit-2",
    action: "refined",
    viewId: "demo-view-delivery-overview",
    viewName: "Executive Delivery Overview",
    actorType: "agent",
    personId: "maria",
    version: 2,
    prompt: "Add where effort is concentrated, show planned vs completed velocity, and flag overdue.",
    diff: [
      "+ donut chart: open effort by project",
      "± velocity chart: single line → planned vs completed",
      "+ KPI: overdue count with week-over-week delta",
    ],
    timeLabel: "26 min ago",
    group: "Today",
  },
  {
    id: "audit-3",
    action: "created",
    viewId: "demo-view-delivery-overview",
    viewName: "Executive Delivery Overview",
    actorType: "agent",
    personId: "maria",
    version: 1,
    prompt:
      "Build me an executive delivery dashboard across all six projects — completion trend, where effort is going, and anything at risk.",
    timeLabel: "34 min ago",
    group: "Today",
  },
  {
    id: "audit-4",
    action: "rejected",
    viewName: "Untitled proposal",
    actorType: "agent",
    personId: "maria",
    prompt: "Also pull each customer's login email into the dashboard with a quick SQL join.",
    detail:
      "Schema validation rejected the proposal: raw SQL is never accepted, and no approved catalog query exposes customer emails. Nothing was executed.",
    timeLabel: "31 min ago",
    group: "Today",
  },
  {
    id: "audit-5",
    action: "refined",
    viewId: "demo-view-team-workload",
    viewName: "Team Workload",
    actorType: "agent",
    personId: "maria",
    version: 2,
    prompt: "Let me filter the workload view by project.",
    diff: ["+ filter bar: project", "± workload chart and table now follow the filter"],
    timeLabel: "2 hr ago",
    group: "Today",
  },
  {
    id: "audit-6",
    action: "created",
    viewId: "demo-view-overdue-risk",
    viewName: "Overdue & At Risk",
    actorType: "agent",
    personId: "maria",
    version: 1,
    prompt: "Which tasks are overdue, who owns them, and how bad is it?",
    timeLabel: "3 hr ago",
    group: "Today",
  },
  {
    id: "audit-7",
    action: "published",
    viewId: "demo-view-launch-readiness",
    viewName: "Portal Launch Readiness",
    actorType: "user",
    personId: "priya",
    version: 1,
    detail: "Published to the whole org ahead of the go/no-go review.",
    timeLabel: "Yesterday, 4:12 PM",
    group: "Yesterday",
  },
  {
    id: "audit-8",
    action: "created",
    viewId: "demo-view-launch-readiness",
    viewName: "Portal Launch Readiness",
    actorType: "agent",
    personId: "priya",
    version: 1,
    prompt: "Are we ready for the Customer Portal launch? Score readiness by workstream and list blockers.",
    timeLabel: "Yesterday, 4:02 PM",
    group: "Yesterday",
  },
  {
    id: "audit-9",
    action: "created",
    viewId: "demo-view-sprint-burndown",
    viewName: "Portal Launch Sprint",
    actorType: "agent",
    personId: "priya",
    version: 1,
    prompt: "Show the current Portal sprint burndown against ideal pace, and what's due this week.",
    timeLabel: "Yesterday, 11:40 AM",
    group: "Yesterday",
  },
  {
    id: "audit-10",
    action: "created",
    viewId: "demo-view-cycle-time",
    viewName: "Cycle Time Trends",
    actorType: "agent",
    personId: "aisha",
    version: 1,
    prompt: "How has our cycle time trended since June? Break it down by stage.",
    timeLabel: "Yesterday, 9:18 AM",
    group: "Yesterday",
  },
  {
    id: "audit-11",
    action: "created",
    viewId: "demo-view-team-workload",
    viewName: "Team Workload",
    actorType: "agent",
    personId: "maria",
    version: 1,
    prompt: "Give me a filterable view of open work by assignee, broken down by status.",
    timeLabel: "Tuesday, 3:45 PM",
    group: "Earlier this week",
  },
  {
    id: "audit-12",
    action: "created",
    viewId: "demo-view-upcoming-week",
    viewName: "Next 7 Days",
    actorType: "agent",
    personId: "nina",
    version: 1,
    prompt: "What's due in the next 7 days across all projects? Let me filter by priority.",
    timeLabel: "Tuesday, 10:02 AM",
    group: "Earlier this week",
  },
  {
    id: "audit-13",
    action: "rolled_back",
    viewId: "demo-view-tasks-by-status",
    viewName: "Tasks by Status",
    actorType: "user",
    personId: "maria",
    version: 2,
    detail: "Rolled back v3 → v2. A refinement had replaced the KPI with a duplicate chart.",
    timeLabel: "Monday, 2:20 PM",
    group: "Earlier this week",
  },
  {
    id: "audit-14",
    action: "created",
    viewId: "demo-view-tasks-by-status",
    viewName: "Tasks by Status",
    actorType: "agent",
    personId: "maria",
    version: 1,
    prompt: "Show me tasks by status as a bar chart",
    detail: "The first view generated in this workspace.",
    timeLabel: "Jul 10, 9:04 AM",
    group: "Older",
  },
];
