import { pgTable, text, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { projectFolders } from "./project-folders";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Who is accountable for the project, and when it's aiming to land.
    // Both optional: plenty of projects have neither, and forcing a lead
    // would make creating one a two-step affair.
    leadId: text("lead_id").references(() => users.id, { onDelete: "set null" }),
    // Optional grouping. Deleting a folder must never delete the work
    // inside it, so this nulls out rather than cascading — the projects
    // simply become ungrouped again.
    folderId: uuid("folder_id").references(() => projectFolders.id, { onDelete: "set null" }),
    targetDate: date("target_date"),
    // Pinned projects float above the folders. A timestamp rather than a
    // boolean so several pins keep a stable, meaningful order.
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    // Archiving replaces deleting. Deleting a project took every task in it
    // with no undo, which is a lot of destruction to hang off one menu item.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("projects_org_created_at_idx").on(table.organizationId, table.createdAt)]
);
