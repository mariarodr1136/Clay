import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// The PDF path drives a headless browser to load one of our own pages, and
// that browser has no Clerk session. Rather than weakening the app's auth or
// handing the browser real credentials, the export route (which *has* already
// authenticated the caller) mints a short-lived signed token naming exactly
// one view, one organization, and one set of filters. The print page trusts
// nothing else: no token, no page.

const TOKEN_TTL_MS = 60_000;

export type PrintTokenPayload = {
  viewId: string;
  organizationId: string;
  filters: Record<string, string>;
};

type SignedPayload = PrintTokenPayload & { exp: number };

function signingSecret(): string {
  // A dedicated secret if one is configured, otherwise the Clerk secret,
  // which is always present server-side and never reaches the client. Either
  // way the token is only ever verified by the same deployment that signed it.
  const secret = process.env.PDF_SIGNING_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error("PDF export requires PDF_SIGNING_SECRET or CLERK_SECRET_KEY to be set");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", signingSecret()).update(body).digest("base64url");
}

export function signPrintToken(payload: PrintTokenPayload): string {
  const signed: SignedPayload = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(signed)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyPrintToken(token: string | undefined): PrintTokenPayload | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  // Both are base64url of a fixed-length digest, so lengths match unless the
  // token was tampered with — check anyway, since timingSafeEqual throws.
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SignedPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (!payload.viewId || !payload.organizationId) return null;
    return {
      viewId: payload.viewId,
      organizationId: payload.organizationId,
      filters: payload.filters ?? {},
    };
  } catch {
    return null;
  }
}
