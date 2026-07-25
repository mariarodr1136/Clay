import { z } from "zod";
import { and, desc, eq, ne, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks, taskStatuses, taskPriorities } from "@/server/db/schema";
import { DEFAULT_ROW_LIMIT, EXPORT_ROW_LIMIT } from "../limits";

export const tasksListParams = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  // true = exclude done tasks ("open work" lists).
  open: z.boolean().optional(),
  // The ceiling here is the export ceiling; interactive callers never get
  // near it because runCatalogQuery clamps them to INTERACTIVE_ROW_LIMIT.
  limit: z.number().int().min(1).max(EXPORT_ROW_LIMIT).default(DEFAULT_ROW_LIMIT),
});

export async function tasksList(organizationId: string, params: z.infer<typeof tasksListParams>) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId)];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));
  if (params.status) conditions.push(eq(tasks.status, params.status));
  if (params.priority) conditions.push(eq(tasks.priority, params.priority));
  if (params.open) conditions.push(ne(tasks.status, "done"));

  return db.query.tasks.findMany({
    where: and(...conditions),
    orderBy: desc(tasks.createdAt),
    limit: params.limit,
  });
}
