import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { agentRunStats } from "@/server/agent/telemetry";
import { listThreads, loadThreadTranscript } from "@/server/agent/threads";

export const agentRouter = router({
  // Rollup behind the agent health panel: how often runs land a view, what
  // they cost, and whether the prompt cache is being hit.
  stats: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).default({ days: 30 }))
    .query(async ({ ctx, input }) => {
      return agentRunStats(ctx.organizationId, input.days);
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
