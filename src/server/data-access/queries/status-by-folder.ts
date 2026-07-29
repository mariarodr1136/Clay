import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks, projects, projectFolders } from "@/server/db/schema";

export const statusByFolderParams = z.object({});

// Per-folder status counts. Folders are how a workspace says which projects
// belong together, so this is the rollup someone actually wants when they
// ask how an area is doing — not a per-project list they have to add up.
// Projects outside every folder are grouped under "Unfiled" rather than
// dropped, or the totals wouldn't reconcile with the rest of the app.
export async function statusByFolder(
  organizationId: string,
  _params: z.infer<typeof statusByFolderParams>
) {
  void _params;
  return db
    .select({
      folder: sql<string>`coalesce(${projectFolders.name}, 'Unfiled')`,
      todo: sql<number>`count(*) filter (where ${tasks.status} = 'todo')::int`,
      in_progress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
      in_review: sql<number>`count(*) filter (where ${tasks.status} = 'in_review')::int`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(projectFolders, eq(projectFolders.id, projects.folderId))
    .where(and(eq(tasks.organizationId, organizationId)))
    .groupBy(projectFolders.name)
    .orderBy(sql`coalesce(${projectFolders.name}, 'Unfiled')`);
}
