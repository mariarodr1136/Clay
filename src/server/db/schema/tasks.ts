import { pgTable, text, timestamp, uuid, date, integer, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { users } from "./users";

export const taskStatuses = ["todo", "in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskPriorities = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export const tasks = pgTable(
  "tasks",
  {
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
    // Story points. 0 means "unestimated" — velocity/effort queries sum this,
    // so an unestimated task simply contributes nothing rather than skewing.
    points: integer("points").notNull().default(0),
    // Free-form labels. An array column rather than a join table: tags are
    // read on every task row and never queried on their own, so a join
    // would cost a trip to save a normalization nobody needs here.
    tags: text("tags").array().notNull().default([]),
    orderIndex: integer("order_index").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // Postgres does not index foreign keys automatically, and every catalog
  // query filters on organization_id first. These cover the catalog's actual
  // access patterns: board/project reads, status rollups, the overdue and
  // upcoming due-date scans, workload-by-assignee, and the completion/
  // velocity queries that filter on updated_at.
  (table) => [
    index("tasks_org_project_idx").on(table.organizationId, table.projectId),
    index("tasks_org_status_idx").on(table.organizationId, table.status),
    index("tasks_org_due_date_idx").on(table.organizationId, table.dueDate),
    index("tasks_org_assignee_idx").on(table.organizationId, table.assigneeId),
    index("tasks_org_created_at_idx").on(table.organizationId, table.createdAt),
    index("tasks_org_updated_at_idx").on(table.organizationId, table.updatedAt),
  ]
);
