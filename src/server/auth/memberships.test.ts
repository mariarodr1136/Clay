import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, memberships } from "@/server/db/schema";

// The constraints that make multi-org membership safe. These are schema
// invariants rather than application logic, so they're asserted against the
// real database — a migration that drops the wrong index would otherwise
// only surface as duplicate workspaces in production.
describe("multi-org memberships", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Membership Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Membership Org B" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_membership_user", email: "m@example.com", name: "Member" })
      .returning();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, user.id));
  });

  it("lets one user belong to several workspaces", async () => {
    await db
      .insert(memberships)
      .values({ organizationId: orgA.id, userId: user.id, role: "owner", isPersonal: true });
    await db
      .insert(memberships)
      .values({ organizationId: orgB.id, userId: user.id, role: "member" });

    const rows = await db.query.memberships.findMany({
      where: eq(memberships.userId, user.id),
    });
    expect(rows).toHaveLength(2);
  });

  it("still refuses two memberships in the same workspace", async () => {
    await expect(
      db.insert(memberships).values({ organizationId: orgB.id, userId: user.id, role: "owner" })
    ).rejects.toThrow();
  });

  it("allows only one personal workspace per user", async () => {
    // The partial unique index is what replaces the old user_id unique
    // constraint as the race guard for personal-workspace provisioning.
    const [orgC] = await db.insert(organizations).values({ name: "Membership Org C" }).returning();
    await expect(
      db
        .insert(memberships)
        .values({ organizationId: orgC.id, userId: user.id, role: "owner", isPersonal: true })
    ).rejects.toThrow();
    await db.delete(organizations).where(eq(organizations.id, orgC.id));
  });

  it("keeps roles independent per workspace", async () => {
    const inA = await db.query.memberships.findFirst({
      where: and(eq(memberships.userId, user.id), eq(memberships.organizationId, orgA.id)),
    });
    const inB = await db.query.memberships.findFirst({
      where: and(eq(memberships.userId, user.id), eq(memberships.organizationId, orgB.id)),
    });
    expect(inA?.role).toBe("owner");
    expect(inB?.role).toBe("member");
  });
});
