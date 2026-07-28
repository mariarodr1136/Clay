import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// A /demo visitor gets a real, disposable tenant rather than a mock: their
// own organization, seeded with sample data, reached through the ordinary
// app. Identity is a signed cookie instead of a Clerk session, so there's no
// account to create and nothing to remember.
//
// The signature is the whole authorization: it names one user id and one
// organization id, and resolveActiveOrg trusts nothing else. Same shape as
// the print token — an HMAC over a base64url body, verified only by the
// deployment that signed it.

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

  const expected = sign(body);
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

// Reads the guest session off the incoming request, if there is a valid one.
export async function readGuestSession(): Promise<GuestSession | null> {
  const store = await cookies();
  return verifyGuestToken(store.get(GUEST_COOKIE)?.value);
}
