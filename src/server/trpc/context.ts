import "server-only";
import { resolveActiveOrg } from "@/server/auth/resolve-org";

export async function createTRPCContext() {
  // Deliberately no auth() call of its own. The middleware skips Clerk
  // entirely for guests, which makes auth() *throw* rather than return an
  // empty session — so asking it first would 500 every demo request.
  // resolveActiveOrg already handles both credentials in the right order and
  // throws only when there is genuinely neither.
  try {
    const { userId, organizationId, role, isGuest } = await resolveActiveOrg();
    return { userId, organizationId, role, isGuest };
  } catch {
    return { userId: null, organizationId: null, role: null, isGuest: false };
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
