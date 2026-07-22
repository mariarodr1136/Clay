import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects, views } from "@/server/db/schema";
import { createView, patchView } from "@/server/db/create-view";
import { proposeViewTool } from "./tools/propose-view";
import { proposeViewInputSchema } from "./tools/schemas";

// Adversarial tests for the invariants the plan's Security Model relies on:
// unknown widget types and catalog ids get rejected, the agent can never
// escalate a view to org scope (create or patch), and cross-org writes fail
// even when a caller has a real version id from the wrong org.
describe("agent security invariants", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let userA: typeof users.$inferSelect;

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Security Test Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Security Test Org B" }).returning();
    [userA] = await db
      .insert(users)
      .values({ id: "test_sec_user_a", email: "seca@example.com", name: "Sec User A" })
      .returning();
    await db.insert(projects).values({ organizationId: orgA.id, name: "Project A", createdBy: userA.id });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, userA.id));
  });

  it("rejects an unknown widget type before it ever reaches persistence", () => {
    const result = proposeViewInputSchema.safeParse({
      name: "Bad view",
      schema: {
        name: "Bad view",
        scope: "personal",
        layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
        widgets: [{ id: "w1", type: "not_a_real_widget_type", config: {} }],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a propose_view whose widget references an unknown catalog query", async () => {
    const result = await proposeViewTool(
      { organizationId: orgA.id, ownerId: userA.id, promptText: "test" },
      {
        name: "Bad binding",
        schema: {
          name: "Bad binding",
          scope: "personal",
          layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
          widgets: [
            {
              id: "w1",
              type: "table",
              dataBinding: { queryId: "dropAllTasks", params: {} },
              config: { columns: [{ key: "title", label: "Title" }] },
            },
          ],
        },
      }
    );
    expect(result.ok).toBe(false);
  });

  it("forces personal scope when the agent creates a view, even if it proposes org scope", async () => {
    const result = await proposeViewTool(
      { organizationId: orgA.id, ownerId: userA.id, promptText: "test" },
      {
        name: "Escalation attempt",
        schema: {
          name: "Escalation attempt",
          scope: "org",
          layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
          widgets: [{ id: "w1", type: "text", config: { content: "hi" } }],
        },
      }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const view = await db.query.views.findFirst({ where: eq(views.id, result.viewId) });
    expect(view?.scope).toBe("personal");
  });

  it("cannot un-publish a view by sneaking a scope change through a patch", async () => {
    const { view } = await createView({
      organizationId: orgA.id,
      ownerId: userA.id,
      name: "Published view",
      schema: {
        name: "Published view",
        scope: "org",
        layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
        widgets: [{ id: "w1", type: "text", config: { content: "hi" } }],
      },
      createdBy: "user",
    });
    expect(view.scope).toBe("org");

    await patchView({
      organizationId: orgA.id,
      viewId: view.id,
      schema: {
        name: "Published view",
        scope: "personal",
        layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
        widgets: [{ id: "w1", type: "text", config: { content: "changed" } }],
      },
      createdBy: "agent",
    });

    const reloaded = await db.query.views.findFirst({ where: eq(views.id, view.id) });
    expect(reloaded?.scope).toBe("org");
  });

  it("cannot patch a view belonging to a different organization", async () => {
    const { view } = await createView({
      organizationId: orgB.id,
      ownerId: userA.id,
      name: "Org B view",
      schema: {
        name: "Org B view",
        scope: "personal",
        layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
        widgets: [{ id: "w1", type: "text", config: { content: "hi" } }],
      },
      createdBy: "user",
    });

    await expect(
      patchView({
        organizationId: orgA.id,
        viewId: view.id,
        schema: {
          name: "Org B view",
          scope: "personal",
          layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
          widgets: [{ id: "w1", type: "text", config: { content: "hijacked" } }],
        },
        createdBy: "agent",
      })
    ).rejects.toThrow("View not found");
  });

  it("rejects an out-of-range row limit on a catalog query param at propose time", async () => {
    const result = await proposeViewTool(
      { organizationId: orgA.id, ownerId: userA.id, promptText: "test" },
      {
        name: "Huge limit",
        schema: {
          name: "Huge limit",
          scope: "personal",
          layout: { widgets: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }] },
          widgets: [
            {
              id: "w1",
              type: "table",
              dataBinding: { queryId: "tasksList", params: { limit: 999999 } },
              config: { columns: [{ key: "title", label: "Title" }] },
            },
          ],
        },
      }
    );
    // tasksListParams caps limit at 200 — the proposal is rejected before
    // it's ever persisted, not just when the widget later tries to render.
    expect(result.ok).toBe(false);
  });
});
