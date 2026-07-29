import { z } from "zod";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export const tasksByTagParams = z.object({
  projectId: z.string().uuid().optional(),
  // Open work only by default: "how much frontend is left" is the question
  // people mean, not "how much frontend have we ever done".
  includeDone: z.boolean().default(false),
});

// Counts per tag. unnest expands the array column so each tag on a task
// contributes a row — a task tagged both "frontend" and "urgent" is counted
// under each, which is what a label is for.
export async function tasksByTag(
  organizationId: string,
  params: z.infer<typeof tasksByTagParams>
) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId)];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));
  if (!params.includeDone) conditions.push(ne(tasks.status, "done"));

  return db
    .select({
      tag: sql<string>`tag`,
      count: sql<number>`count(*)::int`,
      points: sql<number>`coalesce(sum(${tasks.points}), 0)::int`,
    })
    .from(sql`${tasks}, unnest(${tasks.tags}) as tag`)
    .where(and(...conditions))
    .groupBy(sql`tag`)
    .orderBy(sql`count(*) desc`);
}
