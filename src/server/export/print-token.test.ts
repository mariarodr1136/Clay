import { beforeAll, describe, expect, it, vi } from "vitest";
import { signPrintToken, verifyPrintToken } from "./print-token";

// The print page has no session and trusts this token for everything: which
// view, which organization, which filters. If it can be forged, an
// unauthenticated request can read another org's data — so these cases are
// the whole security boundary of the PDF path.
describe("print tokens", () => {
  beforeAll(() => {
    process.env.PDF_SIGNING_SECRET ??= "test-secret";
  });

  const payload = {
    viewId: "11111111-1111-1111-1111-111111111111",
    organizationId: "org_a",
    filters: { status: "todo" },
  };

  it("round-trips a signed payload", () => {
    expect(verifyPrintToken(signPrintToken(payload))).toEqual(payload);
  });

  it("rejects a missing or malformed token", () => {
    expect(verifyPrintToken(undefined)).toBeNull();
    expect(verifyPrintToken("")).toBeNull();
    expect(verifyPrintToken("no-dot")).toBeNull();
    expect(verifyPrintToken("a.b")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [body, signature] = signPrintToken(payload).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, organizationId: "org_b", exp: Date.now() + 60_000 })
    ).toString("base64url");

    // Same signature, different organization — the classic escalation.
    expect(verifyPrintToken(`${forged}.${signature}`)).toBeNull();
    expect(verifyPrintToken(`${body}.${signature}`)).toEqual(payload);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signPrintToken(payload);
    vi.stubEnv("PDF_SIGNING_SECRET", "a-different-secret");
    expect(verifyPrintToken(token)).toBeNull();
    vi.unstubAllEnvs();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    try {
      const token = signPrintToken(payload);
      // Tokens are good for a minute; a link that leaks is useless after that.
      vi.advanceTimersByTime(61_000);
      expect(verifyPrintToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
