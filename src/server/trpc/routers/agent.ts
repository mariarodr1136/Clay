import { z } from "zod";
import { router, protectedProcedure, ownerProcedure } from "../trpc";
import {
  agentRunStats,
  agentRunStatsForUser,
  agentUsageByUser,
} from "@/server/agent/telemetry";
import { listThreads, loadThreadTranscript } from "@/server/agent/threads";

const window = z.object({ days: z.number().int().min(1).max(365).default(30) }).default({
  days: 30,
});

export const agentRouter = router({
  // Rollup behind the agent health panel: how often runs land a view, what
  // they cost, and whether the prompt cache is being hit.
  stats: protectedProcedure.input(window).query(async ({ ctx, input }) => {
    return agentRunStats(ctx.organizationId, input.days);
  }),

  // The caller's own slice of the same window. Not owner-gated: under BYOK
  // these runs were billed to the caller's key, so seeing them needs no
  // more authority than having made them.
  myUsage: protectedProcedure.input(window).query(async ({ ctx, input }) => {
    return agentRunStatsForUser(ctx.organizationId, ctx.userId, input.days);
  }),

  // Who in the workspace is using the agent. Owner-only — a member's usage
  // is theirs and the person above them's, not the whole room's.
  usageByUser: ownerProcedure.input(window).query(async ({ ctx, input }) => {
    return agentUsageByUser(ctx.organizationId, input.days);
  }),

  listThreads: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).default({ limit: 30 }))
    .query(async ({ ctx, input }) => {
      return listThreads(ctx.organizationId, ctx.userId, input.limit);
    }),

  // Reopening a past conversation: the prose turns, without the tool rounds
  // the transcript component renders live.
  transcript: protectedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return loadThreadTranscript(input.threadId, ctx.organizationId, ctx.userId);
    }),
});
