import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

// organizationId here comes only from the authenticated session (never from
// client input) — this is the org-scoping invariant the whole app relies on.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.organizationId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    },
  });
});
