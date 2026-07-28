import "server-only";
import { and, eq } from "drizzle-orm";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db/client";
import { users, organizations, memberships, type MembershipRole } from "@/server/db/schema";

export type ActiveOrg = {
  userId: string;
  organizationId: string;
  role: MembershipRole;
};

// Clerk's roles are namespaced strings ("org:admin", "org:member"). Anything
// with admin authority maps to owner; everything else is a plain member, so
// an unrecognised custom role can never accidentally grant more than the
// least privilege.
function toMembershipRole(clerkRole: string | null | undefined): MembershipRole {
  return clerkRole === "org:admin" ? "owner" : "member";
}

// Mirrors the signed-in Clerk user into our users table. Only reaches for
// Clerk's API when the row is actually missing — the old implementation
// called currentUser() on every single request just to re-derive a row that
// already existed.
async function ensureUserRow(userId: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (existing) return;

  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("resolveActiveOrg called without an authenticated user");

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email || "Unnamed";

  await db
    .insert(users)
    .values({ id: userId, email, name, imageUrl: clerkUser.imageUrl })
    .onConflictDoNothing();
}

// A Clerk Organization is the caller's active workspace. The org row is
// created the first time anyone from that organization signs in, and the
// membership row follows the role Clerk reports — so adding a teammate in
// Clerk's UI is all it takes for them to appear here.
async function syncClerkOrg(
  userId: string,
  clerkOrgId: string,
  clerkRole: string | null | undefined
): Promise<ActiveOrg> {
  const role = toMembershipRole(clerkRole);

  let org = await db.query.organizations.findFirst({
    where: eq(organizations.clerkOrgId, clerkOrgId),
  });

  if (!org) {
    // Only on first sight of an organization — every later request reads
    // the local row instead of calling Clerk.
    const client = await clerkClient();
    const clerkOrg = await client.organizations.getOrganization({ organizationId: clerkOrgId });

    [org] = await db
      .insert(organizations)
      .values({ clerkOrgId, name: clerkOrg.name })
      .onConflictDoNothing({ target: organizations.clerkOrgId })
      .returning();

    // Lost a race with a concurrent first request from the same org.
    org ??= (await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, clerkOrgId),
    }))!;
  }

  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.organizationId, org.id), eq(memberships.userId, userId)),
  });

  if (!membership) {
    await db
      .insert(memberships)
      .values({ organizationId: org.id, userId, role })
      .onConflictDoNothing();
  } else if (membership.role !== role) {
    // Clerk is the source of truth for roles; a promotion or demotion there
    // takes effect on the member's next request rather than needing a
    // webhook to land first.
    await db.update(memberships).set({ role }).where(eq(memberships.id, membership.id));
  }

  return { userId, organizationId: org.id, role };
}

// No active Clerk organization: the user gets their own private workspace,
// exactly as before Organizations existed. This is also the state a brand
// new signup lands in, so onboarding is unchanged.
async function ensurePersonalOrg(userId: string): Promise<ActiveOrg> {
  const existing = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.isPersonal, true)),
  });
  if (existing) {
    return { userId, organizationId: existing.organizationId, role: existing.role };
  }

  const clerkUser = await currentUser();
  const workspaceName = clerkUser?.firstName
    ? `${clerkUser.firstName}'s Workspace`
    : "Personal Workspace";

  const { organizationId } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: workspaceName }).returning();

    const inserted = await tx
      .insert(memberships)
      .values({ organizationId: org.id, userId, role: "owner", isPersonal: true })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      // A concurrent first request already provisioned this user — use
      // their workspace and discard the one just created.
      await tx.delete(organizations).where(eq(organizations.id, org.id));
      const race = await tx.query.memberships.findFirst({
        where: and(eq(memberships.userId, userId), eq(memberships.isPersonal, true)),
      });
      return { organizationId: race!.organizationId };
    }

    // New workspaces start empty on purpose — the app's empty states walk
    // the user into their first project/view, and "Load sample workspace"
    // (projects.seedSample) offers the demo content as an explicit opt-in.
    return { organizationId: org.id };
  });

  return { userId, organizationId, role: "owner" };
}

// The single place the app decides which workspace a request belongs to.
// Everything downstream scopes on the organizationId this returns, and it
// is never taken from client input.
export async function resolveActiveOrg(): Promise<ActiveOrg> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) throw new Error("resolveActiveOrg called without an authenticated user");

  await ensureUserRow(userId);

  return orgId ? syncClerkOrg(userId, orgId, orgRole) : ensurePersonalOrg(userId);
}
