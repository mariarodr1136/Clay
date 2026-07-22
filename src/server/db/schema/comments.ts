import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { tasks } from "./tasks";
import { users } from "./users";

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
