import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users } from "@/server/db/schema";
import { appendTurn, loadThreadHistory, resolveThread } from "./threads";
import { NotFoundError } from "@/server/errors";

describe("agent conversation threads", () => {
  let org: typeof organizations.$inferSelect;
  let otherOrg: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;
  let otherUser: typeof users.$inferSelect;

  beforeAll(async () => {
    [org] = await db.insert(organizations).values({ name: "Threads Org" }).returning();
    [otherOrg] = await db.insert(organizations).values({ name: "Threads Other Org" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_thread_user", email: "t@example.com", name: "Thread User" })
      .returning();
    [otherUser] = await db
      .insert(users)
      .values({ id: "test_thread_other", email: "t2@example.com", name: "Other User" })
      .returning();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, org.id));
    await db.delete(organizations).where(eq(organizations.id, otherOrg.id));
    await db.delete(users).where(eq(users.id, user.id));
    await db.delete(users).where(eq(users.id, otherUser.id));
  });

  const newThread = () =>
    resolveThread({
      organizationId: org.id,
      userId: user.id,
      message: "build me a delivery dashboard",
    });

  it("replays turns in order so a follow-up sees the conversation", async () => {
    const thread = await newThread();
    await appendTurn(thread.id, [
      { role: "user", content: "build me a delivery dashboard" },
      { role: "assistant", content: [{ type: "text", text: "Here it is." }] },
    ]);
    await appendTurn(thread.id, [
      { role: "user", content: "make the chart bigger" },
      { role: "assistant", content: [{ type: "text", text: "Done." }] },
    ]);

    const history = await loadThreadHistory(thread.id);
    expect(history.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(history[0].content).toBe("build me a delivery dashboard");
    expect(history[2].content).toBe("make the chart bigger");
  });

  it("never starts the replay window on an orphaned tool_result", async () => {
    const thread = await newThread();
    // A turn whose tool_use round would be trimmed away if the window were
    // taken as a naive "last N rows" slice.
    await appendTurn(thread.id, [
      { role: "user", content: "first" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu_1", name: "run_query", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_1", content: "rows" }] },
      { role: "assistant", content: [{ type: "text", text: "answer" }] },
    ]);

    const history = await loadThreadHistory(thread.id);
    const first = history[0];
    expect(first.role).toBe("user");
    // The window opens on real user text, never on a tool_result block the
    // matching tool_use has been trimmed away from.
    expect(typeof first.content === "string" || !Array.isArray(first.content)).toBe(true);
  });

  it("refuses to resolve a thread belonging to another user or org", async () => {
    const thread = await newThread();

    await expect(
      resolveThread({
        threadId: thread.id,
        organizationId: org.id,
        userId: otherUser.id,
        message: "steal",
      })
    ).rejects.toBeInstanceOf(NotFoundError);

    await expect(
      resolveThread({
        threadId: thread.id,
        organizationId: otherOrg.id,
        userId: user.id,
        message: "steal",
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
