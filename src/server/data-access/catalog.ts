import "server-only";
import type { z } from "zod";
import { tasksList, tasksListParams } from "./queries/tasks-list";
import { tasksByStatusCount, tasksByStatusCountParams } from "./queries/tasks-by-status-count";
import { tasksByPriorityCount, tasksByPriorityCountParams } from "./queries/tasks-by-priority-count";
import { overdueTasks, overdueTasksParams } from "./queries/overdue-tasks";
import { completionsOverTime, completionsOverTimeParams } from "./queries/completions-over-time";
import { tasksByAssignee, tasksByAssigneeParams } from "./queries/tasks-by-assignee";

type CatalogEntry = {
  description: string;
  paramsSchema: z.ZodTypeAny;
  // organizationId always comes from the authenticated caller, never from params.
  run: (organizationId: string, params: never) => Promise<unknown>;
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
} satisfies Record<string, CatalogEntry>;

export type QueryCatalogKey = keyof typeof queryCatalog;

export function listQueryCatalog() {
  return Object.entries(queryCatalog).map(([id, entry]) => ({
    id,
    description: entry.description,
  }));
}

export async function runCatalogQuery(organizationId: string, queryId: string, rawParams: unknown) {
  const entry = queryCatalog[queryId as QueryCatalogKey];
  if (!entry) {
    throw new Error(`Unknown query catalog id: ${queryId}`);
  }
  const params = entry.paramsSchema.parse(rawParams ?? {});
  return entry.run(organizationId, params as never);
}
