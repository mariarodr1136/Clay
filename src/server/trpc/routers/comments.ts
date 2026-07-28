import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { activityLog, comments, tasks, users } from "@/server/db/schema";
import { ForbiddenError, NotFoundError } from "@/server/errors";

// Comments are always reached through their task, and the task is always
// re-checked against the caller's org first — a comment id alone is never
// enough to read or delete one.
async function ownTask(organizationId: string, taskId: string) {
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)),
  });
  if (!task) throw new NotFoundError("Task");
  return task;
}

export const commentsRouter = router({
  // Everything the task detail panel renders: the task itself, its comment
  // thread with author names, and its slice of the activity log.
  taskDetail: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await ownTask(ctx.organizationId, input.taskId);

      const [thread, history] = await Promise.all([
        db
          .select({
            id: comments.id,
            body: comments.body,
            createdAt: comments.createdAt,
            authorId: comments.authorId,
            authorName: users.name,
            authorImageUrl: users.imageUrl,
          })
          .from(comments)
          .leftJoin(users, eq(users.id, comments.authorId))
          .where(eq(comments.taskId, input.taskId))
          .orderBy(asc(comments.createdAt)),
        db
          .select({
            id: activityLog.id,
            verb: activityLog.verb,
            metadata: activityLog.metadata,
            createdAt: activityLog.createdAt,
            actorName: users.name,
          })
          .from(activityLog)
          .leftJoin(users, eq(users.id, activityLog.actorId))
          .where(
            and(eq(activityLog.entityType, "task"), eq(activityLog.entityId, input.taskId))
          )
          .orderBy(desc(activityLog.createdAt))
          .limit(50),
      ]);

      return { task, comments: thread, history };
    }),

  create: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), body: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      await ownTask(ctx.organizationId, input.taskId);
      const [comment] = await db
        .insert(comments)
        .values({
          organizationId: ctx.organizationId,
          taskId: input.taskId,
          authorId: ctx.userId,
          body: input.body,
        })
        .returning();
      return comment;
    }),

  delete: protectedProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await db.query.comments.findFirst({
        where: and(
          eq(comments.id, input.commentId),
          eq(comments.organizationId, ctx.organizationId)
        ),
      });
      if (!comment) throw new NotFoundError("Comment");
      // Authorship, not org membership, is what gates deletion — otherwise
      // anyone in the workspace could remove anyone else's comment.
      if (comment.authorId !== ctx.userId) {
        throw new ForbiddenError("You can only delete your own comments");
      }

      await db.delete(comments).where(eq(comments.id, input.commentId));
      return { id: input.commentId };
    }),
});
