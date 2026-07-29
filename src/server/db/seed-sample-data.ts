import { db } from "./client";
import {
  projects,
  tasks,
  activityLog,
  comments,
  memberships,
  users,
  agentThreads,
  agentMessages,
  views,
  viewVersions,
} from "./schema";
import { eq } from "drizzle-orm";
import {
  sampleComments,
  sampleConversations,
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
        // Leads only exist when there are teammates to be one; otherwise
        // the person seeding is the only candidate and "led by you" on your
        // own workspace is noise.
        leadId:
          options.withTeammates && project.lead !== undefined
            ? teammateIds[project.lead]
            : null,
        targetDate:
          project.targetInDays === undefined
            ? null
            : isoDate(daysAgo(-project.targetInDays)),
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


// Everything that depends on views existing, so it runs after
// seedSampleViews rather than inside seedSampleData.
//
// Conversations are written as ordinary agent_messages rows — the same shape
// a live run produces — so the chat page replays them through exactly the
// path a real conversation takes. The publish, rollback and blocked events
// go through activity_log and view_versions the same way the real actions
// do, which is what gives the audit log every one of its kinds.
export async function seedSampleHistory(
  organizationId: string,
  userId: string,
  options: { publish?: string[]; rollBack?: string } = {}
) {
  const all = await db
    .select({ id: views.id, name: views.name, currentVersionId: views.currentVersionId })
    .from(views)
    .where(eq(views.organizationId, organizationId));
  const byName = new Map(all.map((view) => [view.name, view]));

  for (const conversation of sampleConversations) {
    const view = conversation.viewName ? byName.get(conversation.viewName) : undefined;
    const startedAt = daysAgo(conversation.daysAgo);

    const [thread] = await db
      .insert(agentThreads)
      .values({
        organizationId,
        userId,
        viewId: view?.id ?? null,
        title: conversation.title,
        createdAt: startedAt,
        updatedAt: startedAt,
      })
      .returning();

    await db.insert(agentMessages).values(
      conversation.turns.map((turn, index) => ({
        threadId: thread.id,
        seq: index,
        role: turn.role,
        // Assistant turns are content blocks, user turns plain strings —
        // matching what runAgentLoop persists.
        content:
          turn.role === "user"
            ? (turn.text as unknown as Record<string, unknown>)
            : ([{ type: "text", text: turn.text }] as unknown as Record<string, unknown>),
        createdAt: new Date(startedAt.getTime() + index * 60_000),
      }))
    );
  }

  for (const name of options.publish ?? []) {
    const view = byName.get(name);
    if (!view) continue;
    await db.update(views).set({ scope: "org" }).where(eq(views.id, view.id));
    await db.insert(activityLog).values({
      organizationId,
      actorId: userId,
      verb: "view.published",
      entityType: "view",
      entityId: view.id,
      metadata: { name },
      createdAt: daysAgo(1),
    });
  }

  // One proposal the validator refused, so the audit log's guardrail row
  // isn't hypothetical. Same shape propose_view records on a real rejection.
  await db.insert(activityLog).values({
    organizationId,
    actorId: userId,
    verb: "view.proposal_blocked",
    entityType: "view",
    entityId: "00000000-0000-0000-0000-000000000000",
    metadata: {
      name: "Revenue by segment",
      reasons: ['Widget "revenueChart": unknown query catalog id "revenueBySegment"'],
    },
    createdAt: daysAgo(2),
  });

  const rollBackTarget = options.rollBack ? byName.get(options.rollBack) : undefined;
  if (rollBackTarget?.currentVersionId) {
    const [current] = await db
      .select()
      .from(viewVersions)
      .where(eq(viewVersions.id, rollBackTarget.currentVersionId));
    if (current) {
      const [restored] = await db
        .insert(viewVersions)
        .values({
          viewId: rollBackTarget.id,
          schemaJson: current.schemaJson,
          createdBy: "user",
          kind: "reverted",
          promptText: "Reverted to an earlier version",
          parentVersionId: current.id,
          createdAt: daysAgo(1),
        })
        .returning();
      await db
        .update(views)
        .set({ currentVersionId: restored.id })
        .where(eq(views.id, rollBackTarget.id));
    }
  }
}
