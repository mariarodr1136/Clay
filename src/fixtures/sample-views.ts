import type { ViewInput } from "@/lib/dsl/schema";

export type SampleViewFixture = {
  key: string;
  prompt: string;
  name: string;
  schema: ViewInput;
};

// The views seeded into a sample workspace (projects.seedSample) — written
// against the live DSL and the real query catalog, so they exercise the
// same renderer path as agent-generated views: KPI rows, stacked bars,
// donuts, filters, and badge-aware tables.
export function buildDemoViews(projectId: string): SampleViewFixture[] {
  const statusSeries = [
    { key: "todo", label: "To do", colorVar: "--status-todo" },
    { key: "in_progress", label: "In progress", colorVar: "--status-in-progress" },
    { key: "in_review", label: "In review", colorVar: "--status-in-review" },
  ];

  return [
    {
      key: "delivery-overview",
      prompt: "Build me a delivery dashboard: open work, overdue risk, and where things stand",
      name: "Delivery Overview",
      schema: {
        name: "Delivery Overview",
        scope: "personal",
        layout: {
          widgets: [
            { id: "openKpi", x: 0, y: 0, w: 4, h: 2 },
            { id: "overdueKpi", x: 4, y: 0, w: 4, h: 2 },
            { id: "reviewKpi", x: 8, y: 0, w: 4, h: 2 },
            { id: "statusChart", x: 0, y: 2, w: 7, h: 3 },
            { id: "effortDonut", x: 7, y: 2, w: 5, h: 3 },
          ],
        },
        widgets: [
          {
            id: "openKpi",
            type: "kpi",
            title: "Open tasks",
            dataBinding: { queryId: "tasksList", params: { open: true, limit: 200 } },
            config: { aggregate: "count", label: "Open tasks", format: "number" },
          },
          {
            id: "overdueKpi",
            type: "kpi",
            title: "Overdue",
            dataBinding: { queryId: "overdueTasks", params: { limit: 200 } },
            config: {
              aggregate: "count",
              label: "Overdue",
              format: "number",
              intent: "danger",
              note: "past due and not done",
            },
          },
          {
            id: "reviewKpi",
            type: "kpi",
            title: "Waiting on review",
            dataBinding: { queryId: "tasksList", params: { status: "in_review", limit: 200 } },
            config: { aggregate: "count", label: "Waiting on review", format: "number" },
          },
          {
            id: "statusChart",
            type: "chart",
            title: "Task status by project",
            dataBinding: { queryId: "statusByProject", params: {} },
            config: {
              chartType: "stackedBar",
              xField: "project",
              series: [...statusSeries, { key: "done", label: "Done", colorVar: "--status-done" }],
            },
          },
          {
            id: "effortDonut",
            type: "chart",
            title: "Open work by project",
            dataBinding: { queryId: "openTasksByProject", params: {} },
            config: {
              chartType: "donut",
              donut: { nameField: "project", valueField: "count", centerLabel: "tasks open" },
            },
          },
        ],
      },
    },
    {
      key: "overdue",
      prompt: "Which tasks are overdue, and how bad is it?",
      name: "Overdue & At Risk",
      schema: {
        name: "Overdue & At Risk",
        scope: "personal",
        layout: {
          widgets: [
            { id: "overdueCount", x: 0, y: 0, w: 4, h: 2 },
            { id: "workload", x: 4, y: 0, w: 8, h: 3 },
            { id: "overdueTable", x: 0, y: 3, w: 12, h: 3 },
          ],
        },
        widgets: [
          {
            id: "overdueCount",
            type: "kpi",
            title: "Overdue",
            dataBinding: { queryId: "overdueTasks", params: { limit: 200 } },
            config: {
              aggregate: "count",
              label: "Overdue tasks",
              format: "number",
              intent: "danger",
            },
          },
          {
            id: "workload",
            type: "chart",
            title: "Open work by assignee",
            dataBinding: { queryId: "openTasksByAssignee", params: {} },
            config: { chartType: "stackedBar", xField: "assignee", series: statusSeries },
          },
          {
            id: "overdueTable",
            type: "table",
            title: "Overdue tasks",
            dataBinding: { queryId: "overdueTasks", params: { limit: 20 } },
            config: {
              columns: [
                { key: "title", label: "Title" },
                { key: "status", label: "Status", kind: "status" },
                { key: "priority", label: "Priority", kind: "priority" },
                { key: "dueDate", label: "Due", kind: "date" },
              ],
            },
          },
        ],
      },
    },
    {
      key: "upcoming-week",
      prompt: "What's due in the next 7 days? Let me filter by priority",
      name: "Next 7 Days",
      schema: {
        name: "Next 7 Days",
        scope: "personal",
        layout: {
          widgets: [
            { id: "priorityFilter", x: 0, y: 0, w: 12, h: 1 },
            { id: "dueCount", x: 0, y: 1, w: 4, h: 2 },
            { id: "completions", x: 4, y: 1, w: 8, h: 3 },
            { id: "upcomingTable", x: 0, y: 4, w: 12, h: 3 },
          ],
        },
        widgets: [
          {
            id: "priorityFilter",
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
            id: "dueCount",
            type: "kpi",
            title: "Due in 7 days",
            dataBinding: {
              queryId: "upcomingTasks",
              params: { days: 7, priority: "$filter:priority", limit: 200 },
            },
            config: { aggregate: "count", label: "Due in 7 days", format: "number" },
          },
          {
            id: "completions",
            type: "chart",
            title: "Completions — last 30 days",
            dataBinding: { queryId: "completionsOverTime", params: { days: 30 } },
            config: { chartType: "area", xField: "day", yField: "count" },
          },
          {
            id: "upcomingTable",
            type: "table",
            title: "Due soon",
            dataBinding: {
              queryId: "upcomingTasks",
              params: { days: 7, priority: "$filter:priority", limit: 30 },
            },
            config: {
              columns: [
                { key: "title", label: "Title" },
                { key: "status", label: "Status", kind: "status" },
                { key: "priority", label: "Priority", kind: "priority" },
                { key: "dueDate", label: "Due", kind: "date" },
              ],
            },
          },
        ],
      },
    },
    {
      key: "tasks-by-status",
      prompt: "Show me tasks by status as a bar chart",
      name: "Tasks by Status",
      schema: {
        name: "Tasks by Status",
        scope: "personal",
        layout: {
          widgets: [
            { id: "total", x: 0, y: 0, w: 3, h: 2 },
            { id: "statusChart", x: 3, y: 0, w: 9, h: 3 },
          ],
        },
        widgets: [
          {
            id: "total",
            type: "kpi",
            title: "Total tasks",
            dataBinding: { queryId: "tasksList", params: { projectId, limit: 200 } },
            config: { aggregate: "count", label: "Total tasks", format: "number" },
          },
          {
            id: "statusChart",
            type: "chart",
            title: "By status",
            dataBinding: { queryId: "tasksByStatusCount", params: { projectId } },
            config: { chartType: "bar", xField: "status", yField: "count" },
          },
        ],
      },
    },
  ];
}
