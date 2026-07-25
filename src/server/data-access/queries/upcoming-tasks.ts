import { z } from "zod";
import { and, asc, eq, gte, lte, ne, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks, taskPriorities } from "@/server/db/schema";
import { DEFAULT_ROW_LIMIT, EXPORT_ROW_LIMIT } from "../limits";

export const upcomingTasksParams = z.object({
  projectId: z.string().uuid().optional(),
  priority: z.enum(taskPriorities).optional(),
  days: z.number().int().min(1).max(90).default(7),
  limit: z.number().int().min(1).max(EXPORT_ROW_LIMIT).default(DEFAULT_ROW_LIMIT),
});

// Open tasks due between today and N days out, soonest first.
export async function upcomingTasks(organizationId: string, params: z.infer<typeof upcomingTasksParams>) {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + params.days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const conditions: SQL[] = [
    eq(tasks.organizationId, organizationId),
    ne(tasks.status, "done"),
    gte(tasks.dueDate, iso(today)),
    lte(tasks.dueDate, iso(horizon)),
  ];
  if (params.projectId) conditions.push(eq(tasks.projectId, params.projectId));
  if (params.priority) conditions.push(eq(tasks.priority, params.priority));

  return db.query.tasks.findMany({
    where: and(...conditions),
    orderBy: asc(tasks.dueDate),
    limit: params.limit,
  });
}
