import { pgTable, text, timestamp, uuid, date, integer } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { users } from "./users";

export const taskStatuses = ["todo", "in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskPriorities = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Denormalized alongside projectId so the query catalog can scope by org
  // without a join on every call.
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: taskStatuses }).notNull().default("todo"),
  priority: text("priority", { enum: taskPriorities }).notNull().default("medium"),
  assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  dueDate: date("due_date"),
  orderIndex: integer("order_index").notNull().default(0),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
