import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE } from "@/server/auth/guest-session";

// The way out of the demo. Clearing the cookie here is what stops a stale
// guest session from shadowing a real one: the middleware routes around
// Clerk whenever the cookie is present, so someone who signed up while still
// holding it would keep landing back in the throwaway workspace.
//
// POST, not GET, and that is not a detail. As a GET this destroyed sessions
// on sight: Next prefetches <Link>s as they enter the viewport, so merely
// rendering the "create an account" button in the demo banner logged the
// visitor out before they clicked anything. GET has to stay safe — the same
// goes for any crawler, link preview, or browser preload.
export async function POST(request: NextRequest) {
  const raw = (await request.formData()).get("to");
  const requested = typeof raw === "string" ? raw : "/sign-up";

  // Same-origin only: the value arrives in a form field, and form fields get
  // edited. Taking just the path drops any host an attacker tried to smuggle
  // in, so this can never become an open redirect.
  const target = new URL(requested, request.url);
  const safe = new URL(target.pathname + target.search, request.url);

  const response = NextResponse.redirect(safe, { status: 303 });
  response.cookies.delete(GUEST_COOKIE);
  return response;
}
