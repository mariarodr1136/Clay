import { z } from "zod";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const completionsOverTimeParams = z.object({
  projectId: z.string().uuid().optional(),
  days: z.number().int().min(1).max(180).default(30),
});

// Uses updatedAt as a proxy for "completed at" — good enough for a demo;
// a dedicated completedAt column would be more precise for a real product.
export async function completionsOverTime(
  organizationId: string,
  params: z.infer<typeof completionsOverTimeParams>
) {
  const since = new Date();
  since.setDate(since.getDate() - params.days);

  const conditions: SQL[] = [
    eq(tasks.organizationId, organizationId),
    eq(tasks.status, "done"),
    gte(tasks.updatedAt, since),
  ];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db
    .select({
      day: sql<string>`date_trunc('day', ${tasks.updatedAt})::date`,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(sql`date_trunc('day', ${tasks.updatedAt})`)
    .orderBy(sql`date_trunc('day', ${tasks.updatedAt})`);
}
