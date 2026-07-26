import { z } from "zod";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const velocityByWeekParams = z.object({
  projectId: z.string().uuid().optional(),
  weeks: z.number().int().min(1).max(26).default(8),
});

// Story points and task count completed per week. Uses updatedAt as the
// completion proxy, same as completionsOverTime; "week" is the Monday of
// each ISO week, pre-formatted for chart axes.
export async function velocityByWeek(
  organizationId: string,
  params: z.infer<typeof velocityByWeekParams>
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
      points: sql<number>`coalesce(sum(${tasks.points}), 0)::int`,
      tasks: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(sql`date_trunc('week', ${tasks.updatedAt})`)
    .orderBy(sql`date_trunc('week', ${tasks.updatedAt})`);
}
