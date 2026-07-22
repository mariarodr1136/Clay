import { z } from "zod";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const tasksByStatusCountParams = z.object({
  projectId: z.string().uuid().optional(),
});

export async function tasksByStatusCount(
  organizationId: string,
  params: z.infer<typeof tasksByStatusCountParams>
) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId)];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db
    .select({ status: tasks.status, count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(tasks.status);
}
