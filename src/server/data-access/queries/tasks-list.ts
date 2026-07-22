import { z } from "zod";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks, taskStatuses, taskPriorities } from "@/server/db/schema";

export const tasksListParams = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export async function tasksList(organizationId: string, params: z.infer<typeof tasksListParams>) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId)];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));
  if (params.status) conditions.push(eq(tasks.status, params.status));
  if (params.priority) conditions.push(eq(tasks.priority, params.priority));

  return db.query.tasks.findMany({
    where: and(...conditions),
    orderBy: desc(tasks.createdAt),
    limit: params.limit,
  });
}
