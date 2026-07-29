import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { agentMessages, agentThreads } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";

// How much of a conversation the model is shown. Every round of a turn is
// persisted (tool calls included), so a long thread grows fast; replaying
// all of it would blow the context window and the bill. The tail is what
// matters for "make that chart bigger" style follow-ups.
const MAX_REPLAYED_MESSAGES = 40;

import type { AgentTurnMessage } from "./loop";

function deriveTitle(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed || "Untitled conversation";
}

// Resolves the thread a request belongs to, creating one on the first
// message. Ownership is re-checked on every call: a thread id is only ever
// usable by the user and org that own it, so a guessed id can't be read
// into another conversation's history.
export async function resolveThread(params: {
  threadId?: string;
  organizationId: string;
  userId: string;
  projectId?: string;
  viewId?: string;
  message: string;
}) {
  if (params.threadId) {
    const thread = await db.query.agentThreads.findFirst({
      where: and(
        eq(agentThreads.id, params.threadId),
        eq(agentThreads.organizationId, params.organizationId),
        eq(agentThreads.userId, params.userId)
      ),
    });
    if (!thread) throw new NotFoundError("Conversation");
    return thread;
  }

  const [thread] = await db
    .insert(agentThreads)
    .values({
      organizationId: params.organizationId,
      userId: params.userId,
      projectId: params.projectId,
      viewId: params.viewId,
      title: deriveTitle(params.message),
    })
    .returning();
  return thread;
}

// The prior turns, oldest-first, in the exact shape the Messages API wants.
//
// Taking the *last* N rows means the window can begin mid-turn — on a
// tool_result whose matching tool_use was trimmed away, which the API
// rejects. So the window is advanced to the first user message carrying
// plain text (a real human turn) rather than tool results.
export async function loadThreadHistory(threadId: string): Promise<Anthropic.MessageParam[]> {
  const rows = await db
    .select({ role: agentMessages.role, content: agentMessages.content })
    .from(agentMessages)
    .where(eq(agentMessages.threadId, threadId))
    .orderBy(desc(agentMessages.seq))
    .limit(MAX_REPLAYED_MESSAGES);

  const ordered = rows.reverse();

  const startsATurn = (row: (typeof ordered)[number]) =>
    row.role === "user" &&
    (typeof row.content === "string" ||
      (Array.isArray(row.content) &&
        !row.content.some(
          (block) => (block as { type?: string })?.type === "tool_result"
        )));

  const firstTurn = ordered.findIndex(startsATurn);
  const window = firstTurn === -1 ? [] : ordered.slice(firstTurn);

  return window.map((row) => ({
    role: row.role,
    content: row.content as Anthropic.MessageParam["content"],
  }));
}

// Appends a completed turn. seq continues from whatever is already stored,
// computed inside the same statement so two concurrent turns in one thread
// can't be handed the same number.
export async function appendTurn(threadId: string, turn: AgentTurnMessage[]) {
  if (turn.length === 0) return;

  await db.transaction(async (tx) => {
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${agentMessages.seq}), -1) + 1` })
      .from(agentMessages)
      .where(eq(agentMessages.threadId, threadId));

    await tx.insert(agentMessages).values(
      turn.map((message, offset) => ({
        threadId,
        seq: Number(next) + offset,
        role: message.role,
        content: message.content as unknown as Record<string, unknown>,
      }))
    );

    await tx
      .update(agentThreads)
      .set({ updatedAt: new Date() })
      .where(eq(agentThreads.id, threadId));
  });
}

export async function listThreads(organizationId: string, userId: string, limit = 30) {
  return db.query.agentThreads.findMany({
    where: and(
      eq(agentThreads.organizationId, organizationId),
      eq(agentThreads.userId, userId)
    ),
    orderBy: desc(agentThreads.updatedAt),
    limit,
  });
}

// Replays a stored thread as flat text for the chat UI. Tool rounds are
// dropped here — the transcript component renders its own live tool call
// entries, and a reloaded conversation only needs the prose.
export async function loadThreadTranscript(
  threadId: string,
  organizationId: string,
  userId: string
) {
  const thread = await db.query.agentThreads.findFirst({
    where: and(
      eq(agentThreads.id, threadId),
      eq(agentThreads.organizationId, organizationId),
      eq(agentThreads.userId, userId)
    ),
  });
  if (!thread) throw new NotFoundError("Conversation");

  const rows = await db
    .select({ role: agentMessages.role, content: agentMessages.content, seq: agentMessages.seq })
    .from(agentMessages)
    .where(eq(agentMessages.threadId, threadId))
    .orderBy(asc(agentMessages.seq));

  const entries = rows.flatMap((row) => {
    if (typeof row.content === "string") {
      return [{ role: row.role, text: row.content }];
    }
    if (!Array.isArray(row.content)) return [];
    const text = row.content
      .filter((block) => (block as { type?: string })?.type === "text")
      .map((block) => (block as { text?: string }).text ?? "")
      .join("")
      .trim();
    return text ? [{ role: row.role, text }] : [];
  });

  return { thread, entries };
}
