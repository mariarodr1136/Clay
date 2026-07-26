import { db } from "./client";
import { projects, tasks, activityLog } from "./schema";

// Realistic starter data for a brand-new organization, so a fresh sign-up
// immediately sees a credible "before" app instead of an empty screen.
export async function seedDemoData(organizationId: string, userId: string) {
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
    {
      title: "Audit current site content",
      description: "Inventory pages, flag anything stale or off-brand.",
      status: "done" as const,
      priority: "medium" as const,
      dueDate: daysFromNow(-6),
      orderIndex: 0,
      points: 3,
    },
    {
      title: "Design new pricing page",
      description: "Three-tier layout, monthly/annual toggle.",
      status: "in_review" as const,
      priority: "high" as const,
      dueDate: daysFromNow(-1),
      orderIndex: 1,
      points: 5,
    },
    {
      title: "Migrate blog to new CMS",
      description: null,
      status: "in_progress" as const,
      priority: "medium" as const,
      dueDate: daysFromNow(4),
      orderIndex: 2,
      points: 8,
    },
    {
      title: "Set up staging environment",
      description: "Mirror prod infra, point at the new DB.",
      status: "in_progress" as const,
      priority: "urgent" as const,
      dueDate: daysFromNow(2),
      orderIndex: 3,
      points: 3,
    },
    {
      title: "Write launch announcement",
      description: null,
      status: "todo" as const,
      priority: "low" as const,
      dueDate: daysFromNow(10),
      orderIndex: 4,
      points: 2,
    },
    {
      title: "QA pass on mobile breakpoints",
      description: "iOS Safari and Android Chrome at minimum.",
      status: "todo" as const,
      priority: "high" as const,
      dueDate: daysFromNow(7),
      orderIndex: 5,
      points: 3,
    },
    {
      title: "Fix broken redirects from old URLs",
      description: null,
      status: "todo" as const,
      priority: "urgent" as const,
      dueDate: daysFromNow(-2),
      orderIndex: 6,
      points: 2,
    },
  ];

  const insertedTasks = await db
    .insert(tasks)
    .values(
      seedTasks.map((t) => ({
        ...t,
        organizationId,
        projectId: project.id,
        assigneeId: userId,
        createdBy: userId,
      }))
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
