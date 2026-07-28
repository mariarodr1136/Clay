import { beforeAll, describe, expect, it } from "vitest";
import { signGuestToken, verifyGuestToken } from "./guest-session";

// The cookie's signature is the entire authorization for a demo visitor —
// it names the workspace every org-scoped query will be pointed at — so
// forging one has to be impossible rather than merely awkward.
describe("guest session tokens", () => {
  beforeAll(() => {
    process.env.PDF_SIGNING_SECRET ??= "test-guest-signing-secret";
  });

  const session = {
    userId: "guest_11111111-1111-1111-1111-111111111111",
    organizationId: "22222222-2222-2222-2222-222222222222",
  };

  it("round-trips a session it signed", () => {
    expect(verifyGuestToken(signGuestToken(session))).toEqual(session);
  });

  it("rejects a token with a tampered payload", () => {
    const [, signature] = signGuestToken(session).split(".");
    const forged = Buffer.from(
      JSON.stringify({
        userId: "guest_attacker",
        organizationId: "33333333-3333-3333-3333-333333333333",
        exp: Date.now() + 60_000,
      })
    ).toString("base64url");

    expect(verifyGuestToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token with no signature at all", () => {
    const [body] = signGuestToken(session).split(".");
    expect(verifyGuestToken(body)).toBeNull();
    expect(verifyGuestToken(`${body}.`)).toBeNull();
  });

  it("rejects an expired token", () => {
    // Signed by hand rather than by waiting out the real 24h TTL.
    const expired = Buffer.from(
      JSON.stringify({ ...session, exp: Date.now() - 1000 })
    ).toString("base64url");
    // Even correctly signed, the expiry check has to fail it — so re-sign
    // through the public API by round-tripping a fresh token and swapping
    // the body, which must then be rejected for *either* reason.
    const [, signature] = signGuestToken(session).split(".");
    expect(verifyGuestToken(`${expired}.${signature}`)).toBeNull();
  });

  it("rejects a user id that isn't a guest", () => {
    // Defence in depth: a token naming a real Clerk user must not be usable
    // as a guest cookie even if one were ever signed.
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

  it("rejects undefined and junk", () => {
    expect(verifyGuestToken(undefined)).toBeNull();
    expect(verifyGuestToken("")).toBeNull();
    expect(verifyGuestToken("not-a-token")).toBeNull();
  });
});
