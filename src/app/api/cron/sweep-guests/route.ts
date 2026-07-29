import { sweepExpiredGuestWorkspaces } from "@/server/auth/guest-workspace";

// Deletes expired demo workspaces. /demo hands every visitor a real tenant,
// so without this the table grows for as long as the site is public.
//
// Vercel signs cron invocations with CRON_SECRET; requiring it means the
// endpoint can't be used by anyone else to force a sweep. Locally, where no
// secret is configured, it stays callable by hand.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { deleted } = await sweepExpiredGuestWorkspaces();
  return Response.json({ deleted });
}
