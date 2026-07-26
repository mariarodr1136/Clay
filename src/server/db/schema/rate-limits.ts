import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

// Fixed-window rate limit state, one row per key (today: per user). Lives in
// Postgres so the limit holds across serverless instances and redeploys —
// an in-memory Map resets whenever the process does, which on Fluid Compute
// means "whenever the platform feels like it."
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(1),
});
