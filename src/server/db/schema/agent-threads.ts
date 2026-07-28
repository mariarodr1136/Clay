import { pgTable, text, timestamp, uuid, jsonb, integer, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// A conversation with the view-building agent. Before this existed, every
// request started from an empty message list: the chat panel showed a
// transcript, but the model only ever saw the newest sentence. Follow-ups
// like "make that chart bigger" only worked because the system prompt
// re-injected the open view's id — not because anything was remembered.
export const agentThreads = pgTable(
  "agent_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Threads are per-user, not per-org: a conversation is a private
    // workspace even when the view it produces gets published.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // What the conversation was anchored to when it started. Kept as plain
    // columns rather than FKs so a thread survives its project or view
    // being deleted — the transcript is still readable history.
    projectId: uuid("project_id"),
    viewId: uuid("view_id"),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_threads_user_updated_at_idx").on(table.userId, table.updatedAt.desc()),
    index("agent_threads_org_idx").on(table.organizationId),
  ]
);

export const agentMessageRoles = ["user", "assistant"] as const;
export type AgentMessageRole = (typeof agentMessageRoles)[number];

// One row per message in the Anthropic sense — including the tool_use /
// tool_result rounds, so replaying a thread reconstructs exactly what the
// model saw. `seq` orders them within a thread; created_at is not reliable
// for this because a single turn writes several rows in one transaction.
export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: text("role", { enum: agentMessageRoles }).notNull(),
    // The raw Anthropic content — a string or an array of content blocks.
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("agent_messages_thread_seq_idx").on(table.threadId, table.seq)]
);
