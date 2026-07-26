import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// A reusable snapshot of a view's schema — "save as template", then stamp
// out new views from it. Org-scoped like everything else; the schema is
// copied at save time, so later edits to the source view don't drift into
// the template.
export const viewTemplates = pgTable("view_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  schemaJson: jsonb("schema_json").notNull().$type<Record<string, unknown>>(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
