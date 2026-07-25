import { z } from "zod";
import { and, asc, eq, lt, ne, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";
import { DEFAULT_ROW_LIMIT, EXPORT_ROW_LIMIT } from "../limits";

export const overdueTasksParams = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(EXPORT_ROW_LIMIT).default(DEFAULT_ROW_LIMIT),
});

export async function overdueTasks(organizationId: string, params: z.infer<typeof overdueTasksParams>) {
  const today = new Date().toISOString().slice(0, 10);
  const conditions: SQL[] = [
    eq(tasks.organizationId, organizationId),
    ne(tasks.status, "done"),
    lt(tasks.dueDate, today),
  ];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));

  return db.query.tasks.findMany({
    where: and(...conditions),
    orderBy: asc(tasks.dueDate),
    limit: params.limit,
  });
}
