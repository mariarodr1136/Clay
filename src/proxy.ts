import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /api/agent and /api/trpc handle their own auth check internally (via
// Clerk's auth()) and return a proper JSON 401 rather than the HTML
// redirect auth.protect() would produce for a non-page request.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/projects(.*)",
  "/views(.*)",
  "/chat(.*)",
  "/audit(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// Deliberately public, and excluded from the matcher so Clerk's middleware
// never runs there: /demo (sample-data showcase), /share/<token> (the token
// is the whole capability), /print (authorized by a signed print token),
// and /health. Keeping them out means a public visitor never pays for an
// auth round-trip — and the /demo e2e suite can run against throwaway keys.
export const config = {
  matcher: [
    "/((?!_next|demo|share|print|health|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
