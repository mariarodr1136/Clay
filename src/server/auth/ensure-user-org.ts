import "server-only";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db/client";
import { users, organizations, memberships } from "@/server/db/schema";

export type CurrentContext = {
  userId: string;
  organizationId: string;
};

// Idempotently mirrors the signed-in Clerk user into our DB and ensures they
// have a personal organization. There is no Clerk Organizations UI yet
// (Phase 1 keeps auth low-friction), so each user gets exactly one org,
// auto-created on first sign-in. The org_id-scoped schema doesn't change
// when real multi-user orgs are added later — only how orgs get created.
export async function ensureUserOrg(): Promise<CurrentContext> {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("ensureUserOrg called without an authenticated user");
  }

  const existingMembership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, clerkUser.id),
  });

  if (existingMembership) {
    return {
      userId: clerkUser.id,
      organizationId: existingMembership.organizationId,
    };
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    email ||
    "Unnamed";

  const { organizationId } = await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({ id: clerkUser.id, email, name, imageUrl: clerkUser.imageUrl })
      .onConflictDoNothing();

    const [org] = await tx
      .insert(organizations)
      .values({
        name: clerkUser.firstName ? `${clerkUser.firstName}'s Workspace` : "Personal Workspace",
      })
      .returning();

    const insertedMembership = await tx
      .insert(memberships)
      .values({ organizationId: org.id, userId: clerkUser.id, role: "owner" })
      .onConflictDoNothing({ target: memberships.userId })
      .returning();

    if (insertedMembership.length === 0) {
      // Lost a race against a concurrent first request that already
      // provisioned this user — use their org and discard the one just
      // created.
      await tx.delete(organizations).where(eq(organizations.id, org.id));
      const existing = await tx.query.memberships.findFirst({
        where: eq(memberships.userId, clerkUser.id),
      });
      return { organizationId: existing!.organizationId };
    }

    // New workspaces start empty on purpose — the app's empty states walk
    // the user into their first project/view, and "Load sample workspace"
    // (projects.seedSample) offers the demo content as an explicit opt-in.
    return { organizationId: org.id };
  });

  return { userId: clerkUser.id, organizationId };
}
