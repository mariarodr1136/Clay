import { pgTable, text, timestamp, uuid, integer, boolean, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const agentRunOutcomes = [
  "view_created",
  "answered",
  "exhausted_rounds",
  "error",
] as const;
export type AgentRunOutcome = (typeof agentRunOutcomes)[number];

// One row per agent invocation. Without this there is no way to answer the
// questions that actually matter for an AI feature — how often does a run
// produce a view, how much does a run cost, is the prompt cache working,
// which model is worth defaulting to — and every system-prompt change is a
// guess. Deliberately records no prompt text beyond what view_versions
// already stores.
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id"),
    model: text("model").notNull(),
    outcome: text("outcome", { enum: agentRunOutcomes }).notNull(),
    // Whether this run was refining an existing view rather than building a
    // new one — refinements and creations have very different success rates.
    isRefinement: boolean("is_refinement").notNull().default(false),
    rounds: integer("rounds").notNull().default(0),
    toolCalls: integer("tool_calls").notNull().default(0),
    toolErrors: integer("tool_errors").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    // Split out from input tokens: `cacheReadTokens` climbing relative to
    // `cacheWriteTokens` is the signal that the prompt-cache breakpoints on
    // the tool schemas and system prompt are actually paying off.
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    // Set when the run produced a view, so quality can be measured by what
    // survives: a view still alive a week later is the real success metric.
    viewId: uuid("view_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_runs_org_created_at_idx").on(table.organizationId, table.createdAt.desc()),
    index("agent_runs_user_created_at_idx").on(table.userId, table.createdAt.desc()),
  ]
);
