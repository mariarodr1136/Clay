import { NextResponse, type NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { GUEST_COOKIE } from "@/server/auth/guest-session";

// /api/agent and /api/trpc handle their own auth check internally and return
// a proper JSON 401 rather than the HTML redirect auth.protect() would
// produce for a non-page request.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/projects(.*)",
  "/views(.*)",
  "/chat(.*)",
  "/audit(.*)",
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
// Presence is all that's checked here on purpose. This is a routing
// decision, not the security boundary — the signature is verified server
// side in resolveActiveOrg, which is what actually picks the organization
// every query is scoped to. A forged cookie gets past this line and then
// resolves to no workspace at all.
export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.cookies.has(GUEST_COOKIE)) {
    return NextResponse.next();
  }
  return withClerk(request, event);
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
