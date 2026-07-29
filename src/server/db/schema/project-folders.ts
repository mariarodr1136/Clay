import { pgTable, text, timestamp, uuid, integer, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// A way to group projects that belong together — by client, by team, by
// quarter, by whatever the workspace actually needs.
//
// Deliberately one level deep rather than a tree. Nested folders need
// breadcrumbs, drag-and-drop between levels, and a story for what happens
// when you delete a parent; a flat set of groups covers what "organize
// these" usually means at this scale, and can grow a parentId later if it
// genuinely doesn't.
export const projectFolders = pgTable(
  "project_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // One of the chart tokens, so a folder can be recognised at a glance
    // without introducing a colour picker.
    colorVar: text("color_var"),
    // Manual ordering, so the folder that matters most doesn't depend on
    // when it happened to be created.
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("project_folders_org_order_idx").on(table.organizationId, table.orderIndex),
  ]
);
