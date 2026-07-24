import { z } from "zod";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks, users } from "@/server/db/schema";

export const openTasksByAssigneeParams = z.object({
  projectId: z.string().uuid().optional(),
});

// Open (not-done) tasks per assignee, split by status — the shape a stacked
// workload chart consumes ({ assignee, todo, in_progress, in_review, total }).
export async function openTasksByAssignee(
  organizationId: string,
  params: z.infer<typeof openTasksByAssigneeParams>
) {
  const conditions: SQL[] = [eq(tasks.organizationId, organizationId), ne(tasks.status, "done")];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db
    .select({
      assignee: sql<string>`coalesce(${users.name}, 'Unassigned')`,
      todo: sql<number>`count(*) filter (where ${tasks.status} = 'todo')::int`,
      in_progress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
      in_review: sql<number>`count(*) filter (where ${tasks.status} = 'in_review')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(...conditions))
    .groupBy(sql`coalesce(${users.name}, 'Unassigned')`)
    .orderBy(sql`count(*) desc`);
}
