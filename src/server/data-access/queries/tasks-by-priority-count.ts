import { z } from "zod";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const tasksByPriorityCountParams = z.object({
  projectId: z.string().uuid().optional(),
});

export async function tasksByPriorityCount(
  organizationId: string,
  params: z.infer<typeof tasksByPriorityCountParams>
) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId)];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db
    .select({ priority: tasks.priority, count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(tasks.priority);
}
