import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks, projects, projectFolders } from "@/server/db/schema";

export const openPointsByFolderParams = z.object({});

// Remaining effort per folder — where the work actually sits when you zoom
// out past individual projects.
export async function openPointsByFolder(
  organizationId: string,
  _params: z.infer<typeof openPointsByFolderParams>
) {
  void _params;
  return db
    .select({
      folder: sql<string>`coalesce(${projectFolders.name}, 'Unfiled')`,
      points: sql<number>`coalesce(sum(${tasks.points}), 0)::int`,
      tasks: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(projectFolders, eq(projectFolders.id, projects.folderId))
    .where(and(eq(tasks.organizationId, organizationId), ne(tasks.status, "done")))
    .groupBy(projectFolders.name)
    .orderBy(sql`sum(${tasks.points}) desc nulls last`);
}
