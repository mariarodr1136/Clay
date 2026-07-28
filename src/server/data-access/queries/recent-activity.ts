import { z } from "zod";
import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { activityLog, tasks, users } from "@/server/db/schema";
import { DEFAULT_ROW_LIMIT, EXPORT_ROW_LIMIT } from "../limits";

export const recentActivityParams = z.object({
  projectId: z.string().uuid().optional(),
  days: z.number().int().min(1).max(365).default(14),
  limit: z.number().int().min(1).max(EXPORT_ROW_LIMIT).default(DEFAULT_ROW_LIMIT),
});

// Row-level "what happened" feed over the append-only activity log, joined
// out to the human-readable names a widget can actually render — the log
// itself only stores ids. Left joins throughout: an actor whose account was
// removed (actor_id is set null on delete) still leaves readable history.
export async function recentActivity(
  organizationId: string,
  params: z.infer<typeof recentActivityParams>
) {
  const since = new Date();
  since.setDate(since.getDate() - params.days);

  const conditions: SQL[] = [
    eq(activityLog.organizationId, organizationId),
    gte(activityLog.createdAt, since),
  ];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db
    .select({
      id: activityLog.id,
      verb: activityLog.verb,
      actor: users.name,
      task: tasks.title,
      taskId: activityLog.entityId,
      at: activityLog.createdAt,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .leftJoin(tasks, eq(tasks.id, activityLog.entityId))
    .where(and(...conditions))
    .orderBy(desc(activityLog.createdAt))
    .limit(params.limit);
}
