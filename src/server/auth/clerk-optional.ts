import "server-only";
import { auth } from "@clerk/nextjs/server";

// Clerk's auth() throws — rather than returning a signed-out result — when
// clerkMiddleware() didn't run for the request. That is a normal, expected
// state in this app: the middleware deliberately routes /demo visitors
// around Clerk entirely, so any page they can reach must be able to ask
// "is someone signed in?" without exploding.
//
// It bit the landing page. A visitor holding a live demo cookie who clicked
// the logo got a runtime error instead of the marketing page, because that
// page calls auth() to decide whether to send signed-in users to their
// dashboard. Every non-protected page has the same exposure, so the safe
// form lives here rather than being remembered at each call site.
//
// A guest is genuinely not a Clerk user, so null is the honest answer.
export async function optionalClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}
