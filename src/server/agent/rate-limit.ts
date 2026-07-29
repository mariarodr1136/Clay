import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

export type RateLimitOptions = {
  windowMs?: number;
  max?: number;
};

// Agent requests are keyed per user, so a tight budget is right. Demo
// workspace creation is keyed per IP, and an IP is not a person — offices,
// universities and mobile carriers put hundreds of people behind one — so it
// gets a wider window rather than turning the front door into a lottery.
export const GUEST_WORKSPACE_LIMIT: RateLimitOptions = {
  windowMs: 10 * 60 * 1000,
  max: 40,
};

// Postgres-backed fixed window: one atomic upsert both starts/rolls the
// window and increments the counter, so concurrent requests across any
// number of instances contend on the row, not on process memory. The old
// in-memory Map silently reset per instance and per deploy.
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const max = options.max ?? MAX_REQUESTS_PER_WINDOW;
  const windowInterval = sql.raw(`interval '${windowMs / 1000} seconds'`);

  const rows = await db.execute<{ window_start: string | Date; count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case
        when rate_limits.window_start < now() - ${windowInterval} then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - ${windowInterval} then now()
        else rate_limits.window_start
      end
    returning window_start, count
  `);

  const row = rows[0];
  const count = Number(row.count);
  if (count <= max) return { ok: true };

  const windowStart = new Date(row.window_start).getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - Date.now()) / 1000));
  return { ok: false, retryAfterSeconds };
}
