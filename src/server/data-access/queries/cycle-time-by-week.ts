import { z } from "zod";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const cycleTimeByWeekParams = z.object({
  projectId: z.string().uuid().optional(),
  weeks: z.number().int().min(1).max(26).default(8),
});

// Average days from creation to completion for tasks finished each week —
// updatedAt is the completion proxy (see completionsOverTime). Without a
// status-transition history this is coarse, but the trend line is honest.
export async function cycleTimeByWeek(
  organizationId: string,
  params: z.infer<typeof cycleTimeByWeekParams>
) {
  const since = new Date();
  since.setDate(since.getDate() - params.weeks * 7);

  const conditions: SQL[] = [
    eq(tasks.organizationId, organizationId),
    eq(tasks.status, "done"),
    gte(tasks.updatedAt, since),
  ];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${tasks.updatedAt}), 'Mon DD')`,
      avgDays: sql<number>`round((avg(extract(epoch from ${tasks.updatedAt} - ${tasks.createdAt})) / 86400)::numeric, 1)::float`,
      tasks: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(sql`date_trunc('week', ${tasks.updatedAt})`)
    .orderBy(sql`date_trunc('week', ${tasks.updatedAt})`);
}
