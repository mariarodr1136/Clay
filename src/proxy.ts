import { NextResponse, type NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { GUEST_COOKIE, verifyGuestToken } from "@/server/auth/guest-token";

// /api/agent and /api/trpc handle their own auth check internally and return
// a proper JSON 401 rather than the HTML redirect auth.protect() would
// produce for a non-page request.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/projects(.*)",
  "/views(.*)",
  "/chat(.*)",
  "/audit(.*)",
  "/settings(.*)",
]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// A /demo visitor browses the very same routes a customer does, holding a
// signed guest cookie instead of a Clerk session. Clerk is skipped entirely
// for them rather than merely not enforced: a signed-out request through
// clerkMiddleware still triggers a handshake against the Clerk instance,
// which a demo visitor has no business paying for.
//
// The signature is verified here, not merely noticed. Checking presence
// alone left a gap that 500'd every protected page: an expired or
// foreign-signed cookie routed the request around Clerk, and then
// resolveActiveOrg rejected the token and fell through to auth(), which
// throws when clerkMiddleware hasn't run. A visitor in that state had no way
// out of it except clearing cookies by hand — so an unusable cookie is now
// stripped on the way past, and the request continues as an ordinary
// signed-out one.
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const cookie = request.cookies.get(GUEST_COOKIE)?.value;

  if (cookie && verifyGuestToken(cookie)) {
    return NextResponse.next();
  }

  // An unusable cookie is treated as no cookie: the request proceeds through
  // Clerk exactly as a signed-out one would, and the dead cookie is stripped
  // from whatever response that produces. Deliberately not a redirect back
  // to the same path — that recovers only if the browser honours the
  // deletion, and loops forever if it doesn't.
  const response = (await withClerk(request, event)) ?? NextResponse.next();
  if (cookie) {
    response.headers.append(
      "Set-Cookie",
      `${GUEST_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    );
  }
  return response;
}

// Deliberately public, and excluded from the matcher so Clerk's middleware
// never runs there: /demo (mints the guest workspace, no Clerk involved),
// /share/<token> (the token is the whole capability), /print (authorized by
// a signed print token), and /health.
export const config = {
  matcher: [
    "/((?!_next|demo|share|print|health|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
