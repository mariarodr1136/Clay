import "server-only";
import { auth } from "@clerk/nextjs/server";
import { ensureUserOrg } from "@/server/auth/ensure-user-org";

export async function createTRPCContext() {
  const { userId } = await auth();
  if (!userId) {
    return { userId: null, organizationId: null };
  }
  const { organizationId } = await ensureUserOrg();
  return { userId, organizationId };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
