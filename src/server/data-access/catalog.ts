import "server-only";
import type { z } from "zod";
import { tasksList, tasksListParams } from "./queries/tasks-list";
import { tasksByStatusCount, tasksByStatusCountParams } from "./queries/tasks-by-status-count";
import { tasksByPriorityCount, tasksByPriorityCountParams } from "./queries/tasks-by-priority-count";
import { overdueTasks, overdueTasksParams } from "./queries/overdue-tasks";
import { completionsOverTime, completionsOverTimeParams } from "./queries/completions-over-time";
import { tasksByAssignee, tasksByAssigneeParams } from "./queries/tasks-by-assignee";
import { statusByProject, statusByProjectParams } from "./queries/status-by-project";
import { upcomingTasks, upcomingTasksParams } from "./queries/upcoming-tasks";
import { openTasksByAssignee, openTasksByAssigneeParams } from "./queries/open-tasks-by-assignee";
import { openTasksByProject, openTasksByProjectParams } from "./queries/open-tasks-by-project";
import { velocityByWeek, velocityByWeekParams } from "./queries/velocity-by-week";
import { createdVsCompleted, createdVsCompletedParams } from "./queries/created-vs-completed";
import { cycleTimeByWeek, cycleTimeByWeekParams } from "./queries/cycle-time-by-week";
import { agingWip, agingWipParams } from "./queries/aging-wip";
import { pointsByProject, pointsByProjectParams } from "./queries/points-by-project";
import { EXPORT_ROW_LIMIT, INTERACTIVE_ROW_LIMIT } from "./limits";

type CatalogEntry = {
  description: string;
  paramsSchema: z.ZodTypeAny;
  // organizationId always comes from the authenticated caller, never from params.
  run: (organizationId: string, params: never) => Promise<unknown>;
  // Set on queries that return raw rows (and therefore accept a `limit`).
  // Exports run at this ceiling instead of the widget's default; aggregate
  // queries leave it unset because they're already one row per group.
  exportRowLimit?: number;
};

// The single allow-listed, org-scoped surface for reading task data. Every
// caller — the app's own UI and, later, the agent — goes through this same
// choke point. No caller (including the agent) ever writes SQL or supplies
// an organizationId; it's always injected from the session.
export const queryCatalog = {
  tasksList: {
    description: "List tasks, optionally filtered by project/status/priority.",
    paramsSchema: tasksListParams,
    run: tasksList,
    exportRowLimit: EXPORT_ROW_LIMIT,
  },
  tasksByStatusCount: {
    description: "Count of tasks grouped by status.",
    paramsSchema: tasksByStatusCountParams,
    run: tasksByStatusCount,
  },
  tasksByPriorityCount: {
    description: "Count of tasks grouped by priority.",
    paramsSchema: tasksByPriorityCountParams,
    run: tasksByPriorityCount,
  },
  overdueTasks: {
    description: "Tasks past their due date that aren't done.",
    paramsSchema: overdueTasksParams,
    run: overdueTasks,
    exportRowLimit: EXPORT_ROW_LIMIT,
  },
  completionsOverTime: {
    description: "Count of tasks completed per day over a recent window.",
    paramsSchema: completionsOverTimeParams,
    run: completionsOverTime,
  },
  tasksByAssignee: {
    description: "Count of tasks grouped by assignee.",
    paramsSchema: tasksByAssigneeParams,
    run: tasksByAssignee,
  },
  statusByProject: {
    description:
      "One row per project with per-status counts (todo/in_progress/in_review/done) — ideal for a stackedBar chart with xField 'project'.",
    paramsSchema: statusByProjectParams,
    run: statusByProject,
  },
  upcomingTasks: {
    description: "Open tasks due within the next N days (default 7), soonest first.",
    paramsSchema: upcomingTasksParams,
    run: upcomingTasks,
    exportRowLimit: EXPORT_ROW_LIMIT,
  },
  openTasksByAssignee: {
    description:
      "Open tasks per assignee split by status ({ assignee, todo, in_progress, in_review, total }) — ideal for a stackedBar workload chart with xField 'assignee'.",
    paramsSchema: openTasksByAssigneeParams,
    run: openTasksByAssignee,
  },
  openTasksByProject: {
    description:
      "Open task count per project ({ project, count }) — where remaining work is concentrated; ideal for a donut chart.",
    paramsSchema: openTasksByProjectParams,
    run: openTasksByProject,
  },
  velocityByWeek: {
    description:
      "Story points and task count completed per week ({ week, points, tasks }) over the last N weeks (default 8) — the velocity trend; ideal for a line or bar chart with xField 'week'.",
    paramsSchema: velocityByWeekParams,
    run: velocityByWeek,
  },
  createdVsCompleted: {
    description:
      "Tasks created vs completed per day ({ day, created, completed }) over the last N days (default 30) — inflow vs outflow; ideal for a two-series line/area chart with xField 'day'.",
    paramsSchema: createdVsCompletedParams,
    run: createdVsCompleted,
  },
  cycleTimeByWeek: {
    description:
      "Average days from task creation to completion, per week completed ({ week, avgDays, tasks }) over the last N weeks (default 8) — the cycle-time trend; ideal for a line chart with xField 'week', yField 'avgDays'.",
    paramsSchema: cycleTimeByWeekParams,
    run: cycleTimeByWeek,
  },
  agingWip: {
    description:
      "Open tasks bucketed by age ({ bucket, count }: 0-3, 4-7, 8-14, 15-30, 30+ days) — stale work at a glance; ideal for a bar chart with xField 'bucket'.",
    paramsSchema: agingWipParams,
    run: agingWip,
  },
  pointsByProject: {
    description:
      "Open story points per project ({ project, points }) — where remaining effort is concentrated; ideal for a donut chart.",
    paramsSchema: pointsByProjectParams,
    run: pointsByProject,
  },
} satisfies Record<string, CatalogEntry>;

export type QueryCatalogKey = keyof typeof queryCatalog;

export function listQueryCatalog() {
  return Object.entries(queryCatalog).map(([id, entry]) => ({
    id,
    description: entry.description,
  }));
}

// The params schemas allow up to EXPORT_ROW_LIMIT rows so exports can ask for
// the whole table. Interactive callers must not: a widget asking for 5,000
// rows would render a table nothing can scroll and hand the agent a payload
// nothing can reason over. Clamping (rather than rejecting) keeps an
// over-eager request useful instead of turning it into a broken widget.
export function clampInteractiveParams(rawParams: unknown): unknown {
  if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) return rawParams;
  const params = rawParams as Record<string, unknown>;
  if (typeof params.limit !== "number" || params.limit <= INTERACTIVE_ROW_LIMIT) return rawParams;
  return { ...params, limit: INTERACTIVE_ROW_LIMIT };
}

// Indexed directly (rather than through a helper returning CatalogEntry) so
// the return type stays the precise union of the catalog's own row types —
// that inference is what gives tRPC clients typed widget data.
export async function runCatalogQuery(organizationId: string, queryId: string, rawParams: unknown) {
  const entry = queryCatalog[queryId as QueryCatalogKey];
  if (!entry) {
    throw new Error(`Unknown query catalog id: ${queryId}`);
  }
  const params = entry.paramsSchema.parse(clampInteractiveParams(rawParams ?? {}));
  return entry.run(organizationId, params as never);
}

export type CatalogExportResult = {
  rows: Record<string, unknown>[];
  // True when the query came back exactly at the cap, i.e. there may be more
  // rows the file doesn't contain. Surfaced in the export so a partial
  // extract is never mistaken for a complete one.
  truncated: boolean;
  rowLimit: number | null;
};

// Same allow-listed choke point as runCatalogQuery — same org scoping, same
// schema validation — but at the export ceiling rather than the widget one.
export async function runCatalogQueryForExport(
  organizationId: string,
  queryId: string,
  rawParams: unknown
): Promise<CatalogExportResult> {
  const entry: CatalogEntry | undefined = queryCatalog[queryId as QueryCatalogKey];
  if (!entry) {
    throw new Error(`Unknown query catalog id: ${queryId}`);
  }
  const rowLimit = entry.exportRowLimit ?? null;

  const base =
    rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)
      ? { ...(rawParams as Record<string, unknown>) }
      : {};
  if (rowLimit !== null) base.limit = rowLimit;

  const params = entry.paramsSchema.parse(base);
  const result = (await entry.run(organizationId, params as never)) as Record<string, unknown>[];
  const rows = Array.isArray(result) ? result : [];

  return { rows, truncated: rowLimit !== null && rows.length >= rowLimit, rowLimit };
}
