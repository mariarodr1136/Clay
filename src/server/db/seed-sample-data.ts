import { db } from "./client";
import { projects, tasks, activityLog, comments, memberships, users } from "./schema";
import {
  sampleComments,
  sampleProjects,
  sampleTeammates,
  type SampleTask,
} from "@/fixtures/sample-workspace";

export type SeedOptions = {
  // Creates the fictional teammates and spreads the work across them.
  //
  // On for /demo, where a one-person workspace would leave the workload
  // charts, assignee filters and comment threads with nothing to show. Off
  // for a real user clicking "load sample workspace", because invented
  // colleagues would sit in their member list and assignee picker forever.
  withTeammates?: boolean;
};

const DAY_MS = 86_400_000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Everything in the fixture is expressed relative to today, so a workspace
// seeded now and one seeded in six months both look freshly worked in.
function taskTimestamps(task: SampleTask) {
  if (task.status === "done") {
    const completedAt = daysAgo((task.doneWeeksAgo ?? 1) * 7);
    return {
      createdAt: new Date(completedAt.getTime() - (task.cycleDays ?? 5) * DAY_MS),
      // The completion-based queries (velocity, cycle time, completions)
      // all read updatedAt as the finish time.
      updatedAt: completedAt,
    };
  }
  const openedAt = daysAgo(task.openedDaysAgo ?? 3);
  return { createdAt: openedAt, updatedAt: openedAt };
}

export async function seedSampleData(
  organizationId: string,
  userId: string,
  options: SeedOptions = {}
) {
  // Ids are namespaced per workspace: two demo visitors must never share a
  // teammate row, since deleting one workspace would take the other's
  // assignees with it.
  const teammateIds = sampleTeammates.map(
    (mate) => `seed_${mate.key}_${organizationId.slice(0, 8)}`
  );

  if (options.withTeammates) {
    await db.insert(users).values(
      sampleTeammates.map((mate, index) => ({
        id: teammateIds[index],
        email: mate.email,
        name: mate.name,
      }))
    );
    await db
      .insert(memberships)
      .values(teammateIds.map((id) => ({ organizationId, userId: id, role: "member" as const })));
  }

  // Without teammates every task falls to the person seeding, which keeps
  // assignee-shaped views working rather than empty.
  const ownerFor = (task: SampleTask) =>
    task.owner === undefined ? null : options.withTeammates ? teammateIds[task.owner] : userId;

  const insertedProjects = await db
    .insert(projects)
    .values(
      sampleProjects.map((project) => ({
        organizationId,
        name: project.name,
        description: project.description,
        createdBy: userId,
        createdAt: daysAgo(90),
      }))
    )
    .returning();

  const taskRows = sampleProjects.flatMap((project, projectIndex) =>
    project.tasks.map((task, taskIndex) => {
      const { createdAt, updatedAt } = taskTimestamps(task);
      return {
        organizationId,
        projectId: insertedProjects[projectIndex].id,
        title: task.title,
        description: task.description ?? null,
        status: task.status,
        priority: task.priority,
        points: task.points,
        assigneeId: ownerFor(task),
        dueDate: task.dueInDays === undefined ? null : isoDate(daysAgo(-task.dueInDays)),
        orderIndex: taskIndex,
        createdBy: userId,
        createdAt,
        updatedAt,
      };
    })
  );

  const insertedTasks = await db.insert(tasks).values(taskRows).returning();
  const taskByTitle = new Map(insertedTasks.map((task) => [task.title, task]));

  const commentRows = sampleComments.flatMap((comment) => {
    const task = taskByTitle.get(comment.taskTitle);
    if (!task) return [];
    return [
      {
        organizationId,
        taskId: task.id,
        authorId: options.withTeammates ? teammateIds[comment.author] : userId,
        body: comment.body,
        createdAt: daysAgo(2),
      },
    ];
  });
  if (commentRows.length > 0) await db.insert(comments).values(commentRows);

  // The activity feed reads this table. Timestamps mirror each task's own
  // history so the feed reads as a record of work rather than of seeding:
  // creation when it was created, and a status change when it finished.
  const activity = insertedTasks.flatMap((task) => {
    const actor = task.assigneeId ?? userId;
    const rows = [
      {
        organizationId,
        actorId: actor,
        verb: "task.created",
        entityType: "task",
        entityId: task.id,
        metadata: { title: task.title } as Record<string, unknown>,
        createdAt: task.createdAt,
      },
    ];
    if (task.status === "done") {
      rows.push({
        organizationId,
        actorId: actor,
        verb: "task.status_changed",
        entityType: "task",
        entityId: task.id,
        metadata: { status: "done" },
        createdAt: task.updatedAt,
      });
    }
    return rows;
  });

  await db.insert(activityLog).values(activity);

  // The first project is what callers hand to the agent as context.
  return insertedProjects[0];
}
