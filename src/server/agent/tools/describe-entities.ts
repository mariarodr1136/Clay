// Hand-maintained rather than introspected from Drizzle metadata — small
// and stable enough that a static description is simpler to control (no
// leaking of internal column types) and to keep in sync by hand for now.
export function describeEntities() {
  return {
    entities: [
      {
        name: "project",
        fields: ["id", "name", "description", "createdAt"],
      },
      {
        name: "task",
        fields: [
          "id",
          "projectId",
          "title",
          "description",
          "status (todo | in_progress | in_review | done)",
          "priority (low | medium | high | urgent)",
          "assigneeId",
          "dueDate (YYYY-MM-DD)",
          "createdAt",
          "updatedAt",
        ],
      },
    ],
    note: "Data isn't queried directly — use list_query_catalog and run_query, which are the only sanctioned read paths.",
  };
}
