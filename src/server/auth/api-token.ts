import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { apiTokens } from "@/server/db/schema";

const TOKEN_BYTES = 32;
export const TOKEN_PREFIX = "clay_";
// Enough to tell two tokens apart in a list, far too little to guess one.
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 6;

export type ApiTokenIdentity = {
  organizationId: string;
  userId: string;
  tokenId: string;
};

// SHA-256 rather than a password hash: this is a 256-bit random value, not a
// human-chosen secret, so there is no dictionary to slow an attacker down
// with — and the lookup happens on every API request, where bcrypt's cost
// would be paid for nothing.
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiToken(): { token: string; tokenHash: string; prefix: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  return {
    token,
    tokenHash: hash(token),
    prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

// Resolves a bearer token to the workspace it acts in. Returns null for
// anything unusable — unknown, revoked, or malformed — without
// distinguishing between them, since the caller has no legitimate use for
// knowing which.
export async function verifyApiToken(raw: string | null): Promise<ApiTokenIdentity | null> {
  if (!raw?.startsWith(TOKEN_PREFIX)) return null;

  const candidate = hash(raw);
  const row = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.tokenHash, candidate), isNull(apiTokens.revokedAt)),
  });
  if (!row) return null;

  // The lookup already matched on the hash, so this is belt-and-braces
  // against a future change that widens the query.
  const expected = Buffer.from(row.tokenHash);
  const actual = Buffer.from(candidate);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  // Best-effort: a failed touch must never cost the caller their request.
  void db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {});

  return { organizationId: row.organizationId, userId: row.userId, tokenId: row.id };
}

export function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}
