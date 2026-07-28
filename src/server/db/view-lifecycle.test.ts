import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, views } from "@/server/db/schema";
import { createView, patchView } from "@/server/db/create-view";
import { getViewTool } from "@/server/agent/tools/get-view";
import { NotFoundError } from "@/server/errors";
import type { ViewInput } from "@/lib/dsl/schema";

const schema: ViewInput = {
  name: "Lifecycle view",
  scope: "personal",
  layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
  widgets: [{ id: "w1", type: "text", config: { content: "hello" } }],
};

// Soft delete is only safe if it holds on *every* read path at once. A view
// in the trash must be invisible to the gallery, to the agent's get_view
// tool, and to anything that would edit it — otherwise a "deleted" view
// keeps answering share links and keeps being patchable by follow-up
// prompts.
describe("view soft delete", () => {
  let org: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;

  beforeAll(async () => {
    [org] = await db.insert(organizations).values({ name: "Lifecycle Test Org" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_lifecycle_user", email: "lc@example.com", name: "LC User" })
      .returning();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, org.id));
    await db.delete(users).where(eq(users.id, user.id));
  });

  async function makeTrashedView() {
    const { view } = await createView({
      organizationId: org.id,
      ownerId: user.id,
      name: "Lifecycle view",
      schema,
      createdBy: "user",
    });
    await db.update(views).set({ deletedAt: new Date() }).where(eq(views.id, view.id));
    return view;
  }

  it("hides a trashed view from the agent's get_view tool", async () => {
    const view = await makeTrashedView();
    const result = await getViewTool(org.id, { viewId: view.id });
    expect(result.ok).toBe(false);
  });

  it("refuses to patch a trashed view", async () => {
    const view = await makeTrashedView();
    await expect(
      patchView({
        organizationId: org.id,
        viewId: view.id,
        schema,
        createdBy: "agent",
        promptText: "should not apply",
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps version history when a view is trashed, so a restore is lossless", async () => {
    const { view } = await createView({
      organizationId: org.id,
      ownerId: user.id,
      name: "Restorable",
      schema,
      createdBy: "user",
    });
    await patchView({
      organizationId: org.id,
      viewId: view.id,
      schema,
      createdBy: "user",
      promptText: "second version",
    });

    await db.update(views).set({ deletedAt: new Date() }).where(eq(views.id, view.id));
    const versions = await db.query.viewVersions.findMany({
      where: (v, { eq: matches }) => matches(v.viewId, view.id),
    });
    expect(versions).toHaveLength(2);

    // Restoring is just clearing the tombstone — the current version pointer
    // is untouched by the delete, so the view comes back exactly as it was.
    await db.update(views).set({ deletedAt: null }).where(eq(views.id, view.id));
    const restored = await getViewTool(org.id, { viewId: view.id });
    expect(restored.ok).toBe(true);
  });
});
