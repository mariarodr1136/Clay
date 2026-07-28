import { z } from "zod";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { projects, tasks, views } from "@/server/db/schema";

const PER_GROUP = 5;

// % and _ are wildcards in LIKE. A user typing "50%" or "snake_case" means
// those literally, so they're escaped before interpolation — otherwise the
// query silently matches far more than they asked for.
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const searchRouter = router({
  // Backs the command palette. Every branch is org-scoped, and views also
  // honour the soft-delete tombstone, so trashed views can't be found and
  // reopened through search.
  all: protectedProcedure
    .input(z.object({ q: z.string().trim().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const pattern = `%${escapeLike(input.q)}%`;

      const [projectHits, viewHits, taskHits] = await Promise.all([
        db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(
            and(eq(projects.organizationId, ctx.organizationId), ilike(projects.name, pattern))
          )
          .orderBy(desc(projects.createdAt))
          .limit(PER_GROUP),

        db
          .select({ id: views.id, name: views.name, scope: views.scope })
          .from(views)
          .where(
            and(
              eq(views.organizationId, ctx.organizationId),
              isNull(views.deletedAt),
              ilike(views.name, pattern)
            )
          )
          .orderBy(desc(views.updatedAt))
          .limit(PER_GROUP),

        db
          .select({
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
            projectId: tasks.projectId,
            projectName: projects.name,
          })
          .from(tasks)
          .innerJoin(projects, eq(projects.id, tasks.projectId))
          .where(
            and(
              eq(tasks.organizationId, ctx.organizationId),
              or(ilike(tasks.title, pattern), ilike(tasks.description, pattern))
            )
          )
          .orderBy(desc(tasks.updatedAt))
          .limit(PER_GROUP),
      ]);

      return { projects: projectHits, views: viewHits, tasks: taskHits };
    }),
});
