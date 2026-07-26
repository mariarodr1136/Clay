import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";
import { checkRateLimit } from "./rate-limit";

const KEY_A = "test_rate_limit_user_a";
const KEY_B = "test_rate_limit_user_b";

describe("postgres-backed rate limiter", () => {
  afterAll(async () => {
    await db.delete(rateLimits).where(inArray(rateLimits.key, [KEY_A, KEY_B]));
  });

  it("allows 10 requests then rejects the 11th with a retry hint", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit(KEY_A)).ok).toBe(true);
    }
    const eleventh = await checkRateLimit(KEY_A);
    expect(eleventh.ok).toBe(false);
    if (!eleventh.ok) {
      expect(eleventh.retryAfterSeconds).toBeGreaterThan(0);
      expect(eleventh.retryAfterSeconds).toBeLessThanOrEqual(300);
    }
  });

  it("limits keys independently", async () => {
    expect((await checkRateLimit(KEY_B)).ok).toBe(true);
  });
});
