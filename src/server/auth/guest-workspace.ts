import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNotNull, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, memberships, users } from "@/server/db/schema";
import { seedSampleData } from "@/server/db/seed-sample-data";
import { seedSampleViews } from "@/server/db/seed-sample-views";
import { GUEST_TTL_MS, type GuestSession } from "./guest-session";

// Provisions the throwaway tenant behind /demo: a real user row, a real
// organization, real seeded projects/tasks/views. Nothing here is special-
// cased downstream — every org-scoped query, mutation, export and agent tool
// treats it exactly like a paying customer's workspace, which is the whole
// point of the demo being the product rather than a replica of it.
export async function createGuestWorkspace(): Promise<GuestSession> {
  const userId = `guest_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + GUEST_TTL_MS);

  const organizationId = await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      // Not a routable address. Guests never receive mail, and the column is
      // non-null because every other code path assumes a user has one.
      email: `${userId}@demo.invalid`,
      name: "Demo visitor",
    });

    const [org] = await tx
      .insert(organizations)
      .values({ name: "Demo Workspace", guestExpiresAt: expiresAt })
      .returning();

    await tx
      .insert(memberships)
      .values({ organizationId: org.id, userId, role: "owner", isPersonal: true });

    return org.id;
  });

  // Seeded outside the transaction: these helpers are the same ones a real
  // user's "Load sample workspace" button calls, and they open their own.
  const project = await seedSampleData(organizationId, userId);
  await seedSampleViews(organizationId, userId, project.id);

  return { userId, organizationId };
}

// True when the session's workspace still exists and hasn't expired. A guest
// returning after the sweeper ran holds a cookie whose organization is gone,
// and every org-scoped query would come back empty rather than obviously
// broken — so /demo checks this and mints a fresh workspace instead.
export async function guestWorkspaceIsLive(session: GuestSession): Promise<boolean> {
  const org = await db.query.organizations.findFirst({
    where: and(
      eq(organizations.id, session.organizationId),
      gt(organizations.guestExpiresAt, new Date())
    ),
  });
  return Boolean(org);
}

// Deletes expired guest workspaces. Everything hangs off the organization by
// cascade — projects, tasks, views, versions, threads, telemetry — so the org
// row is the only thing that has to be named. The guest's user row is
// removed separately, since users aren't owned by an organization.
export async function sweepExpiredGuestWorkspaces(now = new Date()) {
  const expired = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(isNotNull(organizations.guestExpiresAt), lt(organizations.guestExpiresAt, now)));

  if (expired.length === 0) return { deleted: 0 };

  for (const org of expired) {
    const owners = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.organizationId, org.id));

    await db.delete(organizations).where(eq(organizations.id, org.id));

    for (const owner of owners) {
      // Guard on the prefix: a real Clerk user invited into a guest
      // workspace must never be deleted along with it.
      if (owner.userId.startsWith("guest_")) {
        await db.delete(users).where(eq(users.id, owner.userId));
      }
    }
  }

  return { deleted: expired.length };
}
