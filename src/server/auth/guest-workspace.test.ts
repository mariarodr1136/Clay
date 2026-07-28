import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, memberships, projects, users, views } from "@/server/db/schema";
import { createGuestWorkspace, guestWorkspaceIsLive, sweepExpiredGuestWorkspaces } from "./guest-workspace";

describe("guest workspaces", () => {
  const created: string[] = [];
  let realUser: typeof users.$inferSelect;
  let realOrg: typeof organizations.$inferSelect;

  beforeAll(async () => {
    process.env.PDF_SIGNING_SECRET ??= "test-guest-signing-secret";
    [realUser] = await db
      .insert(users)
      .values({ id: "test_real_user_sweep", email: "real@example.com", name: "Real User" })
      .returning();
    [realOrg] = await db.insert(organizations).values({ name: "Real Org" }).returning();
  });

  afterAll(async () => {
    for (const id of created) {
      await db.delete(organizations).where(eq(organizations.id, id));
    }
    await db.delete(organizations).where(eq(organizations.id, realOrg.id));
    await db.delete(users).where(eq(users.id, realUser.id));
  });

  it("hands out a workspace that is already seeded", async () => {
    const session = await createGuestWorkspace();
    created.push(session.organizationId);

    // The demo has to open on something worth looking at — an empty
    // workspace would show the same onboarding screen a new signup gets.
    const seededProjects = await db.query.projects.findMany({
      where: eq(projects.organizationId, session.organizationId),
    });
    const seededViews = await db.query.views.findMany({
      where: eq(views.organizationId, session.organizationId),
    });

    expect(seededProjects.length).toBeGreaterThan(0);
    expect(seededViews.length).toBeGreaterThan(0);
    expect(session.userId.startsWith("guest_")).toBe(true);
    expect(await guestWorkspaceIsLive(session)).toBe(true);
  });

  it("gives each visitor their own workspace", async () => {
    const a = await createGuestWorkspace();
    const b = await createGuestWorkspace();
    created.push(a.organizationId, b.organizationId);

    expect(a.organizationId).not.toBe(b.organizationId);
    expect(a.userId).not.toBe(b.userId);
  });

  it("reports an expired workspace as no longer live", async () => {
    const session = await createGuestWorkspace();
    created.push(session.organizationId);

    await db
      .update(organizations)
      .set({ guestExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(organizations.id, session.organizationId));

    expect(await guestWorkspaceIsLive(session)).toBe(false);
  });

  it("sweeps expired workspaces and their guest users, leaving real ones alone", async () => {
    const doomed = await createGuestWorkspace();
    const living = await createGuestWorkspace();
    created.push(living.organizationId);

    await db
      .update(organizations)
      .set({ guestExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(organizations.id, doomed.organizationId));

    // A real account sitting in the same table must survive the sweep.
    await db
      .insert(memberships)
      .values({ organizationId: realOrg.id, userId: realUser.id, role: "owner" });

    await sweepExpiredGuestWorkspaces();

    const goneOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, doomed.organizationId),
    });
    const goneUser = await db.query.users.findFirst({ where: eq(users.id, doomed.userId) });
    expect(goneOrg).toBeUndefined();
    expect(goneUser).toBeUndefined();

    expect(await guestWorkspaceIsLive(living)).toBe(true);
    expect(
      await db.query.users.findFirst({ where: eq(users.id, realUser.id) })
    ).toBeDefined();
    expect(
      await db.query.organizations.findFirst({
        where: and(eq(organizations.id, realOrg.id), isNotNull(organizations.name)),
      })
    ).toBeDefined();
  });
});
