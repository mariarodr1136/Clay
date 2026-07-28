import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const viewScopes = ["personal", "org"] as const;
export type ViewScope = (typeof viewScopes)[number];

export const viewVersionCreators = ["agent", "user"] as const;
export type ViewVersionCreator = (typeof viewVersionCreators)[number];

export const views = pgTable(
  "views",
  {
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
    // Soft delete. An agent mints a view per request, so the gallery needs a
    // way to discard without destroying history: every version row (and any
    // template stamped from it) survives, and restore is just nulling this.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("views_org_updated_at_idx").on(table.organizationId, table.updatedAt.desc())]
);

// Append-only. Every propose/edit creates a new row rather than mutating an
// existing one, so a view's full prompt/edit history is always recoverable.
export const viewVersions = pgTable(
  "view_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    viewId: uuid("view_id")
      .notNull()
      .references(() => views.id, { onDelete: "cascade" }),
    schemaJson: jsonb("schema_json").notNull().$type<Record<string, unknown>>(),
    createdBy: text("created_by", { enum: viewVersionCreators }).notNull(),
    promptText: text("prompt_text"),
    parentVersionId: uuid("parent_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // Backs both the per-view history panel and the org-wide audit feed, which
  // orders by created_at desc across every view in the org.
  (table) => [
    index("view_versions_view_id_created_at_idx").on(table.viewId, table.createdAt.desc()),
    index("view_versions_created_at_idx").on(table.createdAt.desc()),
  ]
);
