import { desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { memberships, organizations, users } from "@/server/db/schema";

export const membersRouter = router({
  // Everyone in the caller's active workspace. Backs the assignee picker —
  // which previously had no way to list anyone, because a workspace could
  // only ever contain one person.
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        userId: memberships.userId,
        role: memberships.role,
        name: users.name,
        email: users.email,
        imageUrl: users.imageUrl,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.organizationId, ctx.organizationId))
      .orderBy(desc(memberships.role), users.name);
  }),

  // Which workspace the caller is currently acting in, and whether it's
  // their private one or a shared Clerk organization. The header uses this
  // to decide whether to offer the org switcher.
  activeWorkspace: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.organizationId),
    });
    return {
      id: ctx.organizationId,
      name: org?.name ?? "Workspace",
      role: ctx.role,
      isShared: Boolean(org?.clerkOrgId),
    };
  }),
});
