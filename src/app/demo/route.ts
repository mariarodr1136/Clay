import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, GUEST_WORKSPACE_LIMIT } from "@/server/agent/rate-limit";
import { GUEST_COOKIE, GUEST_TTL_MS, readGuestSession, signGuestToken } from "@/server/auth/guest-session";
import { createGuestWorkspace, guestWorkspaceIsLive } from "@/server/auth/guest-workspace";

// The door into the demo, and the only route that knows the demo exists.
//
// /demo used to be a parallel implementation of the product — its own
// renderer, its own widgets, its own fixtures — so every fix landed twice and
// the two drifted. Now it hands the visitor a real (disposable) workspace and
// redirects into the ordinary app, so what they try out is literally the
// product rather than a replica of it.
//
// A Route Handler rather than a page because it sets a cookie, and cookies
// can't be written during Server Component rendering — the response headers
// are already on their way by then.

function clientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for; the first entry is the client.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(request: NextRequest) {
  const existing = await readGuestSession();

  // Returning visitors keep the workspace they were using, so a reload
  // doesn't throw away whatever they just built. A cookie whose workspace the
  // sweeper already collected falls through to a fresh one.
  if (existing && (await guestWorkspaceIsLive(existing))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Provisioning writes real rows, so it's rate limited per IP — the demo is
  // an open door, and an open door that seeds a workspace on every hit is a
  // way to fill someone else's database.
  const rate = await checkRateLimit(`guest:${clientIp(request)}`, GUEST_WORKSPACE_LIMIT);
  if (!rate.ok) {
    return NextResponse.redirect(new URL("/demo/busy", request.url));
  }

  const session = await createGuestWorkspace();

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(GUEST_COOKIE, signGuestToken(session), {
    httpOnly: true,
    sameSite: "lax",
    // Keyed off the actual request protocol, not NODE_ENV: `next start` runs
    // with NODE_ENV=production over plain HTTP, and a Secure cookie there is
    // silently dropped by the browser — so every visit would mint another
    // workspace and nothing would ever be remembered.
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: GUEST_TTL_MS / 1000,
  });
  return response;
}
