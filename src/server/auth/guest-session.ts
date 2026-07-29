import "server-only";
import { cookies } from "next/headers";
import { verifyGuestToken, GUEST_COOKIE } from "./guest-token";

// A /demo visitor gets a real, disposable tenant rather than a mock: their
// own organization, seeded with sample data, reached through the ordinary
// app. Identity is a signed cookie instead of a Clerk session, so there's no
// account to create and nothing to remember.
//
// The signature is the whole authorization: it names one user id and one
// organization id, and resolveActiveOrg trusts nothing else. The signing
// itself lives in guest-token.ts, which the middleware also imports.

export { GUEST_COOKIE, GUEST_TTL_MS, signGuestToken, verifyGuestToken } from "./guest-token";
export type { GuestSession } from "./guest-token";

// Reads the guest session off the incoming request, if there is a valid one.
export async function readGuestSession() {
  const store = await cookies();
  return verifyGuestToken(store.get(GUEST_COOKIE)?.value);
}
