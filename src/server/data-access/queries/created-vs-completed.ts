import { z } from "zod";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const createdVsCompletedParams = z.object({
  projectId: z.string().uuid().optional(),
  days: z.number().int().min(1).max(180).default(30),
});

// Per-day inflow vs outflow — the burnup pairing. Two aggregate scans merged
// by day in code (created and completed land on different timestamps, so a
// single GROUP BY can't produce both columns). Days with activity on either
// side appear with both keys present, so a two-series chart never sees holes.
export async function createdVsCompleted(
  organizationId: string,
  params: z.infer<typeof createdVsCompletedParams>
) {
  const since = new Date();
  since.setDate(since.getDate() - params.days);

  const scope = (extra: SQL[]): SQL[] => {
    const conditions: SQL[] = [eq(tasks.organizationId, organizationId), ...extra];
    if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));
    return conditions;
  };

  const [created, completed] = await Promise.all([
    db
      .select({
        day: sql<string>`date_trunc('day', ${tasks.createdAt})::date`,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(and(...scope([gte(tasks.createdAt, since)])))
      .groupBy(sql`date_trunc('day', ${tasks.createdAt})`),
    db
      .select({
        day: sql<string>`date_trunc('day', ${tasks.updatedAt})::date`,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(and(...scope([eq(tasks.status, "done"), gte(tasks.updatedAt, since)])))
      .groupBy(sql`date_trunc('day', ${tasks.updatedAt})`),
  ]);

  const byDay = new Map<string, { day: string; created: number; completed: number }>();
  const rowFor = (day: string) => {
    const existing = byDay.get(day);
    if (existing) return existing;
    const row = { day, created: 0, completed: 0 };
    byDay.set(day, row);
    return row;
  };
  for (const r of created) rowFor(r.day).created = r.count;
  for (const r of completed) rowFor(r.day).completed = r.count;

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
