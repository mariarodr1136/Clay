import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects, tasks } from "@/server/db/schema";

export const openTasksByProjectParams = z.object({});

// Open task count per project — where the remaining work is concentrated
// ({ project, count }); the natural donut-chart binding.
export async function openTasksByProject(organizationId: string) {
  return db
    .select({
      project: projects.name,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.organizationId, organizationId), ne(tasks.status, "done")))
    .groupBy(projects.id, projects.name)
    .orderBy(sql`count(*) desc`);
}
