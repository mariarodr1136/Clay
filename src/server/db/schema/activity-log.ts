import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// Append-only. Doubles as an audit trail and as queryable data for the
// agent's "show me recent activity" style views (Phase 4+).
export const activityLog = pgTable("activity_log", {
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
});
