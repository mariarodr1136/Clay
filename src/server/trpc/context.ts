import "server-only";
import { auth } from "@clerk/nextjs/server";
import { resolveActiveOrg } from "@/server/auth/resolve-org";

export async function createTRPCContext() {
  const { userId } = await auth();
  if (!userId) {
    return { userId: null, organizationId: null, role: null };
  }
  const { organizationId, role } = await resolveActiveOrg();
  return { userId, organizationId, role };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
