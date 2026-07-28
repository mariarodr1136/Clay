import { z } from "zod";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { activityLog, users } from "@/server/db/schema";

export const activityByUserParams = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

// Aggregate counterpart to recentActivity: one row per person with their
// activity split by kind, which is what a "who's been moving work" bar chart
// or workload table needs. Aggregate queries take no limit — they're
// already one row per actor.
export async function activityByUser(
  organizationId: string,
  params: z.infer<typeof activityByUserParams>
) {
  const since = new Date();
  since.setDate(since.getDate() - params.days);

  const conditions: SQL[] = [
    eq(activityLog.organizationId, organizationId),
    gte(activityLog.createdAt, since),
  ];

  return db
    .select({
      actor: sql<string>`coalesce(${users.name}, 'Unknown')`,
      created: sql<number>`count(*) filter (where ${activityLog.verb} = 'task.created')::int`,
      statusChanges: sql<number>`count(*) filter (where ${activityLog.verb} = 'task.status_changed')::int`,
      assignments: sql<number>`count(*) filter (where ${activityLog.verb} = 'task.assigned')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .where(and(...conditions))
    .groupBy(users.name)
    .orderBy(desc(sql`count(*)`));
}
