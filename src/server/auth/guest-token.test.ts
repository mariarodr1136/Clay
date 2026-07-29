import { beforeAll, describe, expect, it } from "vitest";
import { signGuestToken, verifyGuestToken } from "./guest-token";

// The cookie's signature is the entire authorization for a demo visitor, so
// forging one has to be impossible — and, just as importantly, a token that
// *fails* has to fail cleanly. Middleware and resolveActiveOrg both call
// verifyGuestToken and must agree on every answer: when they disagreed,
// middleware routed a bad cookie around Clerk and the page then 500'd
// calling auth() with no Clerk middleware in the request.
describe("guest tokens", () => {
  beforeAll(() => {
    process.env.PDF_SIGNING_SECRET ??= "test-guest-signing-secret";
  });

  const session = {
    userId: "guest_11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
  };

  it("round-trips a session it signed", () => {
    expect(verifyGuestToken(signGuestToken(session))).toEqual(session);
  });

  it("rejects a tampered payload", () => {
    const [, signature] = signGuestToken(session).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...session, userId: "guest_attacker", exp: Date.now() + 60_000 })
    ).toString("base64url");
    expect(verifyGuestToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const stale = Buffer.from(JSON.stringify({ ...session, exp: Date.now() - 1000 })).toString(
      "base64url"
    );
    const [, signature] = signGuestToken(session).split(".");
    expect(verifyGuestToken(`${stale}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    // The real-world case that surfaced the bug: a cookie left by another
    // deployment on the same host, signed with a secret this one doesn't
    // have. It has to be rejected, and rejected the same way everywhere.
    const original = process.env.PDF_SIGNING_SECRET;
    process.env.PDF_SIGNING_SECRET = "a-completely-different-secret";
    const foreign = signGuestToken(session);
    process.env.PDF_SIGNING_SECRET = original;

    expect(verifyGuestToken(foreign)).toBeNull();
  });

  it("rejects junk without throwing", () => {
    // Middleware runs this on every request; anything that throws there
    // takes the whole site down rather than one page.
    for (const bad of [undefined, "", "garbage", "garbage.signature", "a.b.c", "...."]) {
      expect(() => verifyGuestToken(bad)).not.toThrow();
      expect(verifyGuestToken(bad)).toBeNull();
    }
  });

  it("refuses a token naming a non-guest user", () => {
    const body = Buffer.from(
      JSON.stringify({
        userId: "user_realClerkAccount",
        organizationId: session.organizationId,
        exp: Date.now() + 60_000,
      })
    ).toString("base64url");
    const [, signature] = signGuestToken(session).split(".");
    expect(verifyGuestToken(`${body}.${signature}`)).toBeNull();
  });
});
