import { createHmac, timingSafeEqual } from "node:crypto";

// Signing and verification for the /demo guest cookie, kept apart from
// guest-session.ts so the middleware can import it.
//
// That separation is load-bearing: guest-session.ts is "server-only" and
// reads next/headers cookies, neither of which belongs in middleware — and
// the middleware has to be able to verify a token, not merely notice one.
// Trusting mere presence there is what let an invalid cookie 500 every
// protected page: middleware routed around Clerk, then resolveActiveOrg
// rejected the token and called auth(), which throws when clerkMiddleware
// hasn't run.

export const GUEST_COOKIE = "clay_guest";

// Long enough to actually explore, short enough that the sweeper keeps the
// table small. Matches the guest_expires_at written on the organization.
export const GUEST_TTL_MS = 24 * 60 * 60 * 1000;

export type GuestSession = {
  userId: string;
  organizationId: string;
};

type SignedGuest = GuestSession & { exp: number };

function signingSecret(): string {
  const secret = process.env.PDF_SIGNING_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error("Guest sessions require PDF_SIGNING_SECRET or CLERK_SECRET_KEY to be set");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", signingSecret()).update(body).digest("base64url");
}

export function signGuestToken(session: GuestSession): string {
  const signed: SignedGuest = { ...session, exp: Date.now() + GUEST_TTL_MS };
  const body = Buffer.from(JSON.stringify(signed)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyGuestToken(token: string | undefined): GuestSession | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    // No signing secret configured — treat every token as unusable rather
    // than letting the request through unauthenticated.
    return null;
  }

  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SignedGuest;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (!payload.userId?.startsWith("guest_") || !payload.organizationId) return null;
    return { userId: payload.userId, organizationId: payload.organizationId };
  } catch {
    return null;
  }
}
