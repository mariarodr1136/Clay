import { pgTable, text, timestamp, uuid, jsonb, type AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const viewScopes = ["personal", "org"] as const;
export type ViewScope = (typeof viewScopes)[number];

export const viewVersionCreators = ["agent", "user"] as const;
export type ViewVersionCreator = (typeof viewVersionCreators)[number];

export const views = pgTable("views", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  scope: text("scope", { enum: viewScopes }).notNull().default("personal"),
  name: text("name").notNull(),
  // Set = a public, read-only share link exists for this view (the token IS
  // the capability; unguessable, revocable by nulling). Null = not shared.
  shareToken: text("share_token").unique(),
  currentVersionId: uuid("current_version_id").references((): AnyPgColumn => viewVersions.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Append-only. Every propose/edit creates a new row rather than mutating an
// existing one, so a view's full prompt/edit history is always recoverable.
export const viewVersions = pgTable("view_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  viewId: uuid("view_id")
    .notNull()
    .references(() => views.id, { onDelete: "cascade" }),
  schemaJson: jsonb("schema_json").notNull().$type<Record<string, unknown>>(),
  createdBy: text("created_by", { enum: viewVersionCreators }).notNull(),
  promptText: text("prompt_text"),
  parentVersionId: uuid("parent_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
