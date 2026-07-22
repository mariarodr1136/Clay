import type { ViewInput } from "@/lib/dsl/schema";

export type DemoViewFixture = {
  key: string;
  prompt: string;
  name: string;
  schema: ViewInput;
};

// Hand-authored views proving the DSL -> renderer pipeline against real
// data, with zero agent involvement (Phase 3). The same fixtures double as
// the free canned-demo content in Phase 5 — one source, two uses.
export function buildDemoViews(projectId: string): DemoViewFixture[] {
  return [
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
      key: "overdue",
      prompt: "What's overdue?",
      name: "Overdue Tasks",
      schema: {
        name: "Overdue Tasks",
        scope: "personal",
        layout: {
          widgets: [
            { id: "overdueCount", x: 0, y: 0, w: 3, h: 2 },
            { id: "overdueTable", x: 3, y: 0, w: 9, h: 3 },
          ],
        },
        widgets: [
          {
            id: "overdueCount",
            type: "kpi",
            title: "Overdue",
            dataBinding: { queryId: "overdueTasks", params: { projectId, limit: 200 } },
            config: { aggregate: "count", label: "Overdue tasks", format: "number" },
          },
          {
            id: "overdueTable",
            type: "table",
            title: "Overdue tasks",
            dataBinding: { queryId: "overdueTasks", params: { projectId, limit: 20 } },
            config: {
              columns: [
                { key: "title", label: "Title" },
                { key: "priority", label: "Priority" },
                { key: "dueDate", label: "Due" },
              ],
            },
          },
        ],
      },
    },
    {
      key: "priority-filter",
      prompt: "Give me a filterable view of tasks by priority",
      name: "Tasks by Priority (filterable)",
      schema: {
        name: "Tasks by Priority (filterable)",
        scope: "personal",
        layout: {
          widgets: [
            { id: "priorityFilter", x: 0, y: 0, w: 12, h: 1 },
            { id: "filteredTasks", x: 0, y: 1, w: 12, h: 4 },
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
            id: "filteredTasks",
            type: "table",
            title: "Tasks",
            dataBinding: {
              queryId: "tasksList",
              params: { projectId, priority: "$filter:priority", limit: 50 },
            },
            config: {
              columns: [
                { key: "title", label: "Title" },
                { key: "status", label: "Status" },
                { key: "priority", label: "Priority" },
              ],
            },
          },
        ],
      },
    },
  ];
}
