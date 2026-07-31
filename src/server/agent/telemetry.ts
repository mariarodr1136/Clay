import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { agentRuns, memberships, users } from "@/server/db/schema";
import type { AgentRunResult } from "./loop";

export async function recordAgentRun(params: {
  organizationId: string;
  userId: string;
  threadId: string;
  isRefinement: boolean;
  result: AgentRunResult;
}) {
  const { result } = params;
  await db.insert(agentRuns).values({
    organizationId: params.organizationId,
    userId: params.userId,
    threadId: params.threadId,
    isRefinement: params.isRefinement,
    model: result.model,
    outcome: result.outcome,
    rounds: result.rounds,
    toolCalls: result.toolCalls,
    toolErrors: result.toolErrors,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cacheReadTokens: result.cacheReadTokens,
    cacheWriteTokens: result.cacheWriteTokens,
    latencyMs: result.latencyMs,
    viewId: result.viewId,
    errorMessage: result.errorMessage,
  });
}

// Rollup for the agent health panel: success rate, cost shape, and whether
// the prompt cache is actually being hit.
export async function agentRunStats(organizationId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totals] = await db
    .select({
      runs: sql<number>`count(*)::int`,
      viewsBuilt: sql<number>`count(*) filter (where ${agentRuns.outcome} = 'view_created')::int`,
      answered: sql<number>`count(*) filter (where ${agentRuns.outcome} = 'answered')::int`,
      failed: sql<number>`count(*) filter (where ${agentRuns.outcome} in ('error', 'exhausted_rounds'))::int`,
      toolErrors: sql<number>`coalesce(sum(${agentRuns.toolErrors}), 0)::int`,
      inputTokens: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)::int`,
      cacheReadTokens: sql<number>`coalesce(sum(${agentRuns.cacheReadTokens}), 0)::int`,
      cacheWriteTokens: sql<number>`coalesce(sum(${agentRuns.cacheWriteTokens}), 0)::int`,
      p50LatencyMs: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${agentRuns.latencyMs}), 0)::int`,
      p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${agentRuns.latencyMs}), 0)::int`,
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), gte(agentRuns.createdAt, since)));

  const byModel = await db
    .select({
      model: agentRuns.model,
      runs: sql<number>`count(*)::int`,
      viewsBuilt: sql<number>`count(*) filter (where ${agentRuns.outcome} = 'view_created')::int`,
      avgLatencyMs: sql<number>`coalesce(avg(${agentRuns.latencyMs}), 0)::int`,
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), gte(agentRuns.createdAt, since)))
    .groupBy(agentRuns.model)
    .orderBy(desc(sql`count(*)`));

  return { totals, byModel };
}

// The same rollup narrowed to one person. Every member can see their own
// usage — it's their key paying for it under BYOK, so this is the one cut of
// the data nobody needs a role to look at.
export async function agentRunStatsForUser(organizationId: string, userId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totals] = await db
    .select({
      runs: sql<number>`count(*)::int`,
      viewsBuilt: sql<number>`count(*) filter (where ${agentRuns.outcome} = 'view_created')::int`,
      answered: sql<number>`count(*) filter (where ${agentRuns.outcome} = 'answered')::int`,
      failed: sql<number>`count(*) filter (where ${agentRuns.outcome} in ('error', 'exhausted_rounds'))::int`,
      inputTokens: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)::int`,
      cacheReadTokens: sql<number>`coalesce(sum(${agentRuns.cacheReadTokens}), 0)::int`,
      cacheWriteTokens: sql<number>`coalesce(sum(${agentRuns.cacheWriteTokens}), 0)::int`,
    })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.organizationId, organizationId),
        eq(agentRuns.userId, userId),
        gte(agentRuns.createdAt, since)
      )
    );

  return totals;
}

// Per-person breakdown for the workspace. Owner-only at the router — in a
// shared org this says who is driving the agent (and whose runs are
// failing), which is a reasonable thing for an owner to see and a nosy one
// for a peer. In a personal workspace the caller is always the owner, so it
// simply shows them their own row.
//
// Joined against memberships as well as users so that someone who has left
// the workspace stops appearing, without their historical runs having to be
// deleted from agent_runs.
export async function agentUsageByUser(organizationId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db
    .select({
      userId: agentRuns.userId,
      name: users.name,
      email: users.email,
      imageUrl: users.imageUrl,
      runs: sql<number>`count(*)::int`,
      viewsBuilt: sql<number>`count(*) filter (where ${agentRuns.outcome} = 'view_created')::int`,
      failed: sql<number>`count(*) filter (where ${agentRuns.outcome} in ('error', 'exhausted_rounds'))::int`,
      inputTokens: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)::int`,
      lastRunAt: sql<Date>`max(${agentRuns.createdAt})`,
    })
    .from(agentRuns)
    .innerJoin(users, eq(users.id, agentRuns.userId))
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, agentRuns.userId),
        eq(memberships.organizationId, agentRuns.organizationId)
      )
    )
    .where(and(eq(agentRuns.organizationId, organizationId), gte(agentRuns.createdAt, since)))
    .groupBy(agentRuns.userId, users.name, users.email, users.imageUrl)
    .orderBy(desc(sql`count(*)`));
}
