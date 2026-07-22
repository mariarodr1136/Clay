import { z } from "zod";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const tasksByAssigneeParams = z.object({
  projectId: z.string().uuid().optional(),
});

export async function tasksByAssignee(
  organizationId: string,
  params: z.infer<typeof tasksByAssigneeParams>
) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId)];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db
    .select({ assigneeId: tasks.assigneeId, count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(tasks.assigneeId);
}
