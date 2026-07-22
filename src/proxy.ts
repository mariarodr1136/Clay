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

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
