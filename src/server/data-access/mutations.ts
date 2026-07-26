import "server-only";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  activityLog,
  memberships,
  projects,
  tasks,
  taskPriorities,
  taskStatuses,
} from "@/server/db/schema";

// The write-side twin of the query catalog: a fixed, allow-listed set of
// org-scoped mutations. Same invariants — organizationId and the acting
// user always come from the authenticated session, never from params, and
// every entry validates its params against its own zod schema.
//
// The agent has NO tool that reaches this catalog. It can propose widgets
// that are *bound* to a mutation (a task-creation form, a status dropdown
// on a table row), but the mutation itself only ever runs when a signed-in
// user clicks, under that user's own session. execute-tool.ts's tool set is
// the enforcement point, and the security suite asserts it.

async function logActivity(
  organizationId: string,
  actorId: string,
  verb: string,
  taskId: string,
  metadata: Record<string, unknown>
) {
  await db.insert(activityLog).values({
    organizationId,
    actorId,
    verb,
    entityType: "task",
    entityId: taskId,
    metadata,
  });
}

// Loads a task only if it belongs to the caller's org — every task-editing
// mutation goes through this, so a foreign task id behaves exactly like a
// nonexistent one.
async function ownTask(organizationId: string, taskId: string) {
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)),
  });
  if (!task) throw new Error("Task not found");
  return task;
}

const createTaskParams = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  priority: z.enum(taskPriorities).default("medium"),
  dueDate: z.string().date().optional(),
  points: z.number().int().min(0).max(100).default(0),
});

async function createTask(
  organizationId: string,
  actorId: string,
  params: z.infer<typeof createTaskParams>
) {
  // The project must be the caller's own — otherwise a task row could be
  // stitched onto another org's project.
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.organizationId, organizationId)),
  });
  if (!project) throw new Error("Project not found");

  const [task] = await db
    .insert(tasks)
    .values({
      organizationId,
      projectId: params.projectId,
      title: params.title,
      description: params.description,
      priority: params.priority,
      dueDate: params.dueDate,
      points: params.points,
      createdBy: actorId,
    })
    .returning();

  await logActivity(organizationId, actorId, "task.created", task.id, { title: task.title });
  return task;
}

const updateTaskStatusParams = z.object({
  taskId: z.string().uuid(),
  status: z.enum(taskStatuses),
});

async function updateTaskStatus(
  organizationId: string,
  actorId: string,
  params: z.infer<typeof updateTaskStatusParams>
) {
  await ownTask(organizationId, params.taskId);
  const [task] = await db
    .update(tasks)
    .set({ status: params.status, updatedAt: new Date() })
    .where(and(eq(tasks.id, params.taskId), eq(tasks.organizationId, organizationId)))
    .returning();

  await logActivity(organizationId, actorId, "task.status_changed", task.id, {
    status: params.status,
  });
  return task;
}

const assignTaskParams = z.object({
  taskId: z.string().uuid(),
  // null clears the assignee.
  assigneeId: z.string().nullable(),
});

async function assignTask(
  organizationId: string,
  actorId: string,
  params: z.infer<typeof assignTaskParams>
) {
  await ownTask(organizationId, params.taskId);

  if (params.assigneeId !== null) {
    // Assignees must be members of the caller's own org — a bare user id
    // from another workspace is rejected, not silently attached.
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, params.assigneeId)
      ),
    });
    if (!membership) throw new Error("Assignee is not a member of this workspace");
  }

  const [task] = await db
    .update(tasks)
    .set({ assigneeId: params.assigneeId, updatedAt: new Date() })
    .where(and(eq(tasks.id, params.taskId), eq(tasks.organizationId, organizationId)))
    .returning();

  await logActivity(organizationId, actorId, "task.assigned", task.id, {
    assigneeId: params.assigneeId,
  });
  return task;
}

const setTaskDueDateParams = z.object({
  taskId: z.string().uuid(),
  // null clears the due date.
  dueDate: z.string().date().nullable(),
});

async function setTaskDueDate(
  organizationId: string,
  actorId: string,
  params: z.infer<typeof setTaskDueDateParams>
) {
  await ownTask(organizationId, params.taskId);
  const [task] = await db
    .update(tasks)
    .set({ dueDate: params.dueDate, updatedAt: new Date() })
    .where(and(eq(tasks.id, params.taskId), eq(tasks.organizationId, organizationId)))
    .returning();

  await logActivity(organizationId, actorId, "task.due_date_changed", task.id, {
    dueDate: params.dueDate,
  });
  return task;
}

type MutationEntry = {
  description: string;
  paramsSchema: z.ZodTypeAny;
  run: (organizationId: string, actorId: string, params: never) => Promise<unknown>;
};

export const mutationCatalog = {
  createTask: {
    description: "Create a task in one of the caller's own projects.",
    paramsSchema: createTaskParams,
    run: createTask,
  },
  updateTaskStatus: {
    description: "Move a task to another status column.",
    paramsSchema: updateTaskStatusParams,
    run: updateTaskStatus,
  },
  assignTask: {
    description: "Assign a task to a workspace member (or clear the assignee).",
    paramsSchema: assignTaskParams,
    run: assignTask,
  },
  setTaskDueDate: {
    description: "Set or clear a task's due date.",
    paramsSchema: setTaskDueDateParams,
    run: setTaskDueDate,
  },
} satisfies Record<string, MutationEntry>;

export type MutationCatalogKey = keyof typeof mutationCatalog;

export async function runCatalogMutation(
  organizationId: string,
  actorId: string,
  mutationId: string,
  rawParams: unknown
) {
  const entry = mutationCatalog[mutationId as MutationCatalogKey];
  if (!entry) {
    throw new Error(`Unknown mutation catalog id: ${mutationId}`);
  }
  const params = entry.paramsSchema.parse(rawParams ?? {});
  return entry.run(organizationId, actorId, params as never);
}
