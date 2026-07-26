import { z } from "zod";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const agingWipParams = z.object({
  projectId: z.string().uuid().optional(),
});

const buckets = ["0-3 days", "4-7 days", "8-14 days", "15-30 days", "30+ days"] as const;

// Open tasks bucketed by how long they've existed. Every bucket is always
// present (zero-filled) and in age order, so a bar chart's x-axis is stable
// no matter what the data looks like.
export async function agingWip(organizationId: string, params: z.infer<typeof agingWipParams>) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId), ne(tasks.status, "done")];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  const ageDays = sql`extract(epoch from now() - ${tasks.createdAt}) / 86400`;
  const bucket = sql<string>`case
    when ${ageDays} <= 3 then '0-3 days'
    when ${ageDays} <= 7 then '4-7 days'
    when ${ageDays} <= 14 then '8-14 days'
    when ${ageDays} <= 30 then '15-30 days'
    else '30+ days'
  end`;

  const rows = await db
    .select({ bucket, count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(bucket);

  const byBucket = new Map(rows.map((r) => [r.bucket, r.count]));
  return buckets.map((b) => ({ bucket: b, count: byBucket.get(b) ?? 0 }));
}
