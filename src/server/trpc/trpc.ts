import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "./context";
import { DomainError, type DomainErrorKind } from "@/server/errors";

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

export const router = t.router;

const DOMAIN_ERROR_CODES: Record<DomainErrorKind, TRPCError["code"]> = {
  not_found: "NOT_FOUND",
  forbidden: "FORBIDDEN",
  invalid: "BAD_REQUEST",
  conflict: "CONFLICT",
};

// Maps domain errors thrown below the router layer onto tRPC codes, so a
// missing view reaches the client as NOT_FOUND rather than as an opaque
// INTERNAL_SERVER_ERROR the UI can only render as "something went wrong".
// Anything that isn't a DomainError is left alone — an unexpected throw
// should still be a 500, not be laundered into a friendly 4xx.
// next() resolves to a result object rather than rethrowing, so a resolver
// error arrives here as `result.error` — a TRPCError whose `cause` is
// whatever was actually thrown. Unwrapping that cause is the only way to
// see the DomainError underneath.
const withDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const cause = result.error.cause;
    if (cause instanceof DomainError) {
      throw new TRPCError({
        code: DOMAIN_ERROR_CODES[cause.kind],
        message: cause.message,
        cause,
      });
    }
  }
  return result;
});

export const publicProcedure = t.procedure.use(withDomainErrors);

// organizationId here comes only from the authenticated session (never from
// client input) — this is the org-scoping invariant the whole app relies on.
export const protectedProcedure = t.procedure.use(withDomainErrors).use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.organizationId || !ctx.role) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      role: ctx.role,
      isGuest: ctx.isGuest,
    },
  });
});

// For actions that reshape the whole workspace rather than one person's
// work — seeding sample data over an org, publishing org-wide, destroying a
// project and its tasks. In a personal workspace the only member is always
// the owner, so this is a no-op there and only bites in a shared org.
export const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only workspace owners can do that.",
    });
  }
  return next({ ctx });
});
