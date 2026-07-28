import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// Append-only. Doubles as an audit trail and as queryable data for the
// agent's "show me recent activity" style views (see the recentActivity /
// activityByUser catalog entries).
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    verb: text("verb").notNull(), // e.g. "task.created", "task.status_changed"
    entityType: text("entity_type").notNull(), // e.g. "task", "project"
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // The feed reads newest-first within an org; the entity index backs the
    // per-task history on the task detail panel.
    index("activity_log_org_created_at_idx").on(table.organizationId, table.createdAt.desc()),
    index("activity_log_entity_idx").on(table.entityType, table.entityId),
  ]
);
