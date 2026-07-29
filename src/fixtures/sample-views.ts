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
            { id: "openKpi", x: 0, y: 0, w: 3, h: 2 },
            { id: "overdueKpi", x: 3, y: 0, w: 3, h: 2 },
            { id: "reviewKpi", x: 6, y: 0, w: 3, h: 2 },
            { id: "velocityKpi", x: 9, y: 0, w: 3, h: 2 },
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
            // The only tile with a trend: velocityByWeek returns an ordered
            // series, so the sparkline and the delta are both computed from
            // the rows behind the number.
            id: "velocityKpi",
            type: "kpi",
            title: "Velocity",
            dataBinding: { queryId: "velocityByWeek", params: { weeks: 8 } },
            config: {
              aggregate: "sum",
              field: "points",
              label: "Points shipped",
              format: "number",
              trend: { field: "points", goodDirection: "up" },
            },
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
    {
      key: "team-workload",
      prompt: "Who is carrying what right now, and who is closest to overloaded?",
      name: "Team Workload",
      schema: {
        name: "Team Workload",
        scope: "personal",
        layout: {
          widgets: [
            { id: "openTotal", x: 0, y: 0, w: 3, h: 2 },
            { id: "unassigned", x: 3, y: 0, w: 3, h: 2 },
            { id: "workloadChart", x: 6, y: 0, w: 6, h: 4 },
            { id: "activeTable", x: 0, y: 2, w: 6, h: 4 },
          ],
        },
        widgets: [
          {
            id: "openTotal",
            type: "kpi",
            title: "Open work",
            dataBinding: { queryId: "tasksList", params: { open: true, limit: 200 } },
            config: { aggregate: "count", label: "Open tasks", format: "number" },
          },
          {
            id: "unassigned",
            type: "kpi",
            title: "Story points open",
            dataBinding: { queryId: "tasksList", params: { open: true, limit: 200 } },
            config: {
              aggregate: "sum",
              field: "points",
              label: "Points in flight",
              format: "number",
              note: "across every project",
            },
          },
          {
            id: "workloadChart",
            type: "chart",
            title: "Open work per person",
            dataBinding: { queryId: "openTasksByAssignee", params: {} },
            config: { chartType: "stackedBar", xField: "assignee", series: statusSeries },
          },
          {
            // statusActions turns each row's status into a live dropdown —
            // the write path a person can drive from a generated view.
            id: "activeTable",
            type: "table",
            title: "In flight",
            dataBinding: { queryId: "tasksList", params: { status: "in_progress", limit: 25 } },
            config: {
              statusActions: true,
              columns: [
                { key: "title", label: "Task" },
                { key: "status", label: "Status", kind: "status" },
                { key: "priority", label: "Priority", kind: "priority" },
                { key: "points", label: "Pts", kind: "number" },
              ],
            },
          },
        ],
      },
    },
    {
      key: "velocity-and-flow",
      prompt: "How fast are we going, and is our cycle time getting better or worse?",
      name: "Velocity & Flow",
      schema: {
        name: "Velocity & Flow",
        scope: "personal",
        layout: {
          widgets: [
            { id: "velocityKpi", x: 0, y: 0, w: 3, h: 2 },
            { id: "cycleKpi", x: 3, y: 0, w: 3, h: 2 },
            { id: "velocityChart", x: 6, y: 0, w: 6, h: 3 },
            { id: "flowChart", x: 0, y: 2, w: 6, h: 3 },
            { id: "cycleChart", x: 6, y: 3, w: 6, h: 3 },
          ],
        },
        widgets: [
          {
            id: "velocityKpi",
            type: "kpi",
            title: "Velocity",
            dataBinding: { queryId: "velocityByWeek", params: { weeks: 12 } },
            config: {
              aggregate: "sum",
              field: "points",
              label: "Points shipped",
              format: "number",
              trend: { field: "points", goodDirection: "up" },
            },
          },
          {
            // goodDirection down: cycle time climbing is bad news, so the
            // same arrow shape means the opposite thing here.
            id: "cycleKpi",
            type: "kpi",
            title: "Cycle time",
            dataBinding: { queryId: "cycleTimeByWeek", params: { weeks: 12 } },
            config: {
              aggregate: "avg",
              field: "avgDays",
              label: "Avg days to done",
              format: "number",
              trend: { field: "avgDays", goodDirection: "down" },
            },
          },
          {
            id: "velocityChart",
            type: "chart",
            title: "Velocity by week",
            dataBinding: { queryId: "velocityByWeek", params: { weeks: 12 } },
            config: {
              chartType: "bar",
              xField: "week",
              series: [{ key: "points", label: "Points", colorVar: "--chart-1" }],
            },
          },
          {
            id: "flowChart",
            type: "chart",
            title: "Created vs completed",
            dataBinding: { queryId: "createdVsCompleted", params: { days: 60 } },
            config: {
              chartType: "line",
              xField: "day",
              series: [
                { key: "created", label: "Created", colorVar: "--chart-2" },
                { key: "completed", label: "Completed", colorVar: "--chart-1" },
              ],
            },
          },
          {
            id: "cycleChart",
            type: "chart",
            title: "Cycle time by week",
            dataBinding: { queryId: "cycleTimeByWeek", params: { weeks: 12 } },
            config: { chartType: "area", xField: "week", yField: "avgDays" },
          },
        ],
      },
    },
    {
      key: "portfolio",
      prompt: "Show me the whole portfolio: where the effort sits and what is stalling",
      name: "Portfolio Health",
      schema: {
        name: "Portfolio Health",
        scope: "personal",
        layout: {
          widgets: [
            { id: "projectFilter", x: 0, y: 0, w: 12, h: 1 },
            { id: "effortDonut", x: 0, y: 1, w: 5, h: 3 },
            { id: "agingChart", x: 5, y: 1, w: 7, h: 3 },
            { id: "byPriority", x: 0, y: 4, w: 5, h: 3 },
            { id: "stalled", x: 5, y: 4, w: 7, h: 3 },
          ],
        },
        widgets: [
          {
            // Other widgets read this selection through "$filter:project".
            id: "projectFilter",
            type: "filterBar",
            config: {
              filterKey: "project",
              label: "Project",
              options: [{ label: "Everything", value: "" }],
            },
          },
          {
            id: "effortDonut",
            type: "chart",
            title: "Where the effort is",
            dataBinding: { queryId: "pointsByProject", params: {} },
            config: {
              chartType: "donut",
              donut: { nameField: "project", valueField: "points", centerLabel: "Open points" },
            },
          },
          {
            id: "agingChart",
            type: "chart",
            title: "How long open work has been open",
            dataBinding: { queryId: "agingWip", params: {} },
            config: {
              chartType: "bar",
              xField: "bucket",
              series: [{ key: "count", label: "Tasks", colorVar: "--chart-3" }],
            },
          },
          {
            id: "byPriority",
            type: "chart",
            title: "By priority",
            dataBinding: { queryId: "tasksByPriorityCount", params: {} },
            config: {
              chartType: "bar",
              xField: "priority",
              series: [{ key: "count", label: "Tasks", colorVar: "--chart-4" }],
            },
          },
          {
            id: "stalled",
            type: "table",
            title: "Oldest open work",
            dataBinding: { queryId: "tasksList", params: { open: true, limit: 15 } },
            config: {
              columns: [
                { key: "title", label: "Task" },
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
      key: "activity",
      prompt: "What has the team actually been doing lately?",
      name: "Recent Activity",
      schema: {
        name: "Recent Activity",
        scope: "personal",
        layout: {
          widgets: [
            { id: "note", x: 0, y: 0, w: 12, h: 1 },
            { id: "perPerson", x: 0, y: 1, w: 6, h: 3 },
            { id: "feed", x: 6, y: 1, w: 6, h: 3 },
          ],
        },
        widgets: [
          {
            id: "note",
            type: "text",
            config: {
              content:
                "Every task created, moved, assigned or rescheduled is recorded — this reads that log.",
            },
          },
          {
            id: "perPerson",
            type: "chart",
            title: "Activity per person",
            dataBinding: { queryId: "activityByUser", params: { days: 30 } },
            config: {
              chartType: "stackedBar",
              xField: "actor",
              series: [
                { key: "created", label: "Created", colorVar: "--chart-1" },
                { key: "statusChanges", label: "Moved", colorVar: "--chart-2" },
              ],
            },
          },
          {
            id: "feed",
            type: "table",
            title: "Latest",
            dataBinding: { queryId: "recentActivity", params: { days: 30, limit: 20 } },
            config: {
              columns: [
                { key: "actor", label: "Who" },
                { key: "task", label: "Task" },
                { key: "at", label: "When", kind: "date" },
              ],
            },
          },
        ],
      },
    },
  ];
}
