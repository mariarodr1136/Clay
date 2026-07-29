import { db } from "./client";
import { projects, tasks, activityLog } from "./schema";

// Realistic starter data for a brand-new organization, so a fresh sign-up
// immediately sees a credible "before" app instead of an empty screen.
export async function seedSampleData(organizationId: string, userId: string) {
  const [project] = await db
    .insert(projects)
    .values({
      organizationId,
      name: "Website Relaunch",
      description: "Rebuild the marketing site and ship the new pricing page.",
      createdBy: userId,
    })
    .returning();

  const today = new Date();
  const daysFromNow = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const seedTasks = [
    // Finished work first, oldest to newest. A sample workspace with one
    // completed task has no delivery history, which leaves velocity, cycle
    // time and completions with a single bar each and a KPI trend with
    // nothing to compare against.
    {
      title: "Pick a CMS and get sign-off",
      description: "Shortlist three, cost them out, agree with marketing.",
      status: "done" as const,
      priority: "high" as const,
      dueDate: daysFromNow(-40),
      orderIndex: 0,
      points: 5,
    },
    {
      title: "Move DNS to the new provider",
      description: "Cut over records with a short TTL, keep the old zone warm.",
      status: "done" as const,
      priority: "medium" as const,
      dueDate: daysFromNow(-33),
      orderIndex: 1,
      points: 3,
    },
    {
      title: "Agree the new sitemap",
      description: "Collapse the old nav from nine sections to five.",
      status: "done" as const,
      priority: "medium" as const,
      dueDate: daysFromNow(-26),
      orderIndex: 2,
      points: 8,
    },
    {
      title: "Audit current site content",
      description: "Inventory pages, flag anything stale or off-brand.",
      status: "done" as const,
      priority: "medium" as const,
      dueDate: daysFromNow(-19),
      orderIndex: 3,
      points: 8,
    },
    {
      title: "Rebuild the component library",
      description: "Buttons, forms, cards — everything the new pages need.",
      status: "done" as const,
      priority: "high" as const,
      dueDate: daysFromNow(-6),
      orderIndex: 4,
      points: 13,
    },
    {
      title: "Design new pricing page",
      description: "Three-tier layout, monthly/annual toggle.",
      status: "in_review" as const,
      priority: "high" as const,
      dueDate: daysFromNow(-1),
      orderIndex: 5,
      points: 5,
    },
    {
      title: "Migrate blog to new CMS",
      description: null,
      status: "in_progress" as const,
      priority: "medium" as const,
      dueDate: daysFromNow(4),
      orderIndex: 6,
      points: 8,
    },
    {
      title: "Set up staging environment",
      description: "Mirror prod infra, point at the new DB.",
      status: "in_progress" as const,
      priority: "urgent" as const,
      dueDate: daysFromNow(2),
      orderIndex: 7,
      points: 3,
    },
    {
      title: "Write launch announcement",
      description: null,
      status: "todo" as const,
      priority: "low" as const,
      dueDate: daysFromNow(10),
      orderIndex: 8,
      points: 2,
    },
    {
      title: "QA pass on mobile breakpoints",
      description: "iOS Safari and Android Chrome at minimum.",
      status: "todo" as const,
      priority: "high" as const,
      dueDate: daysFromNow(7),
      orderIndex: 9,
      points: 3,
    },
    {
      title: "Fix broken redirects from old URLs",
      description: null,
      status: "todo" as const,
      priority: "urgent" as const,
      dueDate: daysFromNow(-2),
      orderIndex: 10,
      points: 2,
    },
  ];

  // Spread the timestamps over the past couple of months instead of stamping
  // everything with "now".
  //
  // Every time-series query in the catalog buckets by week or day —
  // velocity, cycle time, completions, created-vs-completed — so a workspace
  // seeded all at one instant collapses every one of them to a single bar,
  // and a KPI trend has nothing to compare against. The sample workspace is
  // the first thing a demo visitor and a new signup see, so its charts have
  // to look like charts.
  const weekAgo = (weeks: number) => {
    const d = new Date();
    d.setDate(d.getDate() - weeks * 7);
    return d;
  };

  const insertedTasks = await db
    .insert(tasks)
    .values(
      seedTasks.map((t, index) => {
        // Done tasks land in successive past weeks, so velocity and cycle
        // time have a real series; open work is recent, as it would be.
        const completedWeeksAgo = 6 - index;
        const finished = t.status === "done";
        return {
          ...t,
          organizationId,
          projectId: project.id,
          assigneeId: userId,
          createdBy: userId,
          createdAt: weekAgo(finished ? completedWeeksAgo + 2 : 1),
          // updatedAt is what the completion-based queries read.
          updatedAt: finished ? weekAgo(Math.max(completedWeeksAgo, 0)) : weekAgo(0),
        };
      })
    )
    .returning();

  await db.insert(activityLog).values(
    insertedTasks.map((t) => ({
      organizationId,
      actorId: userId,
      verb: "task.created",
      entityType: "task",
      entityId: t.id,
      metadata: { title: t.title },
    }))
  );

  return project;
}
