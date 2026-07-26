import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects, tasks } from "@/server/db/schema";

export const pointsByProjectParams = z.object({});

// Open story points per project — where the remaining effort actually sits,
// as opposed to openTasksByProject's raw task counts. Takes no params, so
// the catalog's params argument is simply not declared.
export async function pointsByProject(organizationId: string) {
  return db
    .select({
      project: projects.name,
      points: sql<number>`coalesce(sum(${tasks.points}), 0)::int`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.organizationId, organizationId), ne(tasks.status, "done")))
    .groupBy(projects.id, projects.name)
    .orderBy(sql`sum(${tasks.points}) desc nulls last`);
}
