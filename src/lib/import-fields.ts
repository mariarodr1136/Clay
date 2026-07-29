// Shared by the import dialog and the server-side mapper. Kept out of
// src/server/import so the client can import it without pulling the Drizzle
// schema (and the whole ORM) into the browser bundle.

export const IMPORT_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "points",
  "assignee",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  priority: "Priority",
  dueDate: "Due date",
  points: "Points",
  assignee: "Assignee",
};
