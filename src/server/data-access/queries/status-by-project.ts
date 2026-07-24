import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects, tasks } from "@/server/db/schema";

export const statusByProjectParams = z.object({});

// One row per project with a column per status — the shape stacked bar
// charts consume directly ({ project, todo, in_progress, in_review, done }).
export async function statusByProject(organizationId: string) {
  return db
    .select({
      project: projects.name,
      todo: sql<number>`count(*) filter (where ${tasks.status} = 'todo')::int`,
      in_progress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
      in_review: sql<number>`count(*) filter (where ${tasks.status} = 'in_review')::int`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.organizationId, organizationId))
    .groupBy(projects.id, projects.name)
    .orderBy(projects.name);
}
