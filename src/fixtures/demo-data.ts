import type { taskPriorities, taskStatuses } from "@/server/db/schema";
import { resolveBindingParams } from "@/lib/dsl/resolve-params";

// Static, DB-free fixture set backing every /demo/* route: a six-project
// portfolio with a full team, ~50 tasks, and pre-computed trend series, so
// the demo showcases what a mature Clay workspace looks like — no auth, no
// DB reads or writes, intentionally public.
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return daysFromNow(0);
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type DemoPerson = {
  id: string;
  name: string;
  initials: string;
  role: string;
  colorVar: string;
};

export const demoPeople: DemoPerson[] = [
  { id: "maria", name: "Maria Rodriguez", initials: "MR", role: "Product Lead", colorVar: "--chart-1" },
  { id: "james", name: "James Okafor", initials: "JO", role: "Frontend Engineer", colorVar: "--chart-2" },
  { id: "priya", name: "Priya Sharma", initials: "PS", role: "Backend Engineer", colorVar: "--chart-3" },
  { id: "tomas", name: "Tomás Silva", initials: "TS", role: "Product Designer", colorVar: "--chart-4" },
  { id: "aisha", name: "Aisha Khan", initials: "AK", role: "Data Engineer", colorVar: "--chart-5" },
  { id: "leo", name: "Leo Martins", initials: "LM", role: "Platform Engineer", colorVar: "--chart-1" },
  { id: "nina", name: "Nina Petrova", initials: "NP", role: "QA Engineer", colorVar: "--chart-2" },
  { id: "sam", name: "Sam Chen", initials: "SC", role: "Security Engineer", colorVar: "--chart-3" },
];

const peopleById = new Map(demoPeople.map((p) => [p.id, p]));

export function demoPerson(id: string): DemoPerson {
  return peopleById.get(id) ?? demoPeople[0];
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type DemoProjectHealth = "on_track" | "at_risk" | "ahead";

export type DemoProject = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  leadId: string;
  memberIds: string[];
  health: DemoProjectHealth;
  targetDate: string;
  colorVar: string;
};

export const demoProjects: DemoProject[] = [
  {
    id: "demo-project-website",
    name: "Website Relaunch",
    shortName: "Website",
    description: "Rebuild the marketing site on the new stack and ship the redesigned pricing page.",
    leadId: "maria",
    memberIds: ["maria", "james", "tomas", "leo", "nina"],
    health: "on_track",
    targetDate: daysFromNow(18),
    colorVar: "--chart-1",
  },
  {
    id: "demo-project-mobile",
    name: "Mobile App v2",
    shortName: "Mobile",
    description: "Ground-up rewrite with offline sync, biometric login, and sub-2s cold starts.",
    leadId: "james",
    memberIds: ["james", "priya", "tomas", "nina"],
    health: "at_risk",
    targetDate: daysFromNow(32),
    colorVar: "--chart-2",
  },
  {
    id: "demo-project-data",
    name: "Data Platform Migration",
    shortName: "Data",
    description: "Move the warehouse to the lakehouse, rebuild core marts in dbt, backfill 24 months.",
    leadId: "aisha",
    memberIds: ["aisha", "leo", "nina", "sam", "maria"],
    health: "on_track",
    targetDate: daysFromNow(55),
    colorVar: "--chart-3",
  },
  {
    id: "demo-project-portal",
    name: "Customer Portal",
    shortName: "Portal",
    description: "Self-serve billing, SSO, team management, and audit exports for enterprise plans.",
    leadId: "priya",
    memberIds: ["priya", "james", "tomas", "aisha", "leo"],
    health: "ahead",
    targetDate: daysFromNow(22),
    colorVar: "--chart-4",
  },
  {
    id: "demo-project-soc2",
    name: "SOC 2 Compliance",
    shortName: "SOC 2",
    description: "Type II readiness: control mapping, automated evidence collection, access reviews.",
    leadId: "sam",
    memberIds: ["sam", "leo", "priya", "nina", "maria"],
    health: "at_risk",
    targetDate: daysFromNow(12),
    colorVar: "--chart-5",
  },
  {
    id: "demo-project-design",
    name: "Design System 2.0",
    shortName: "Design Sys",
    description: "Token architecture, dark mode, and a component library with migration codemods.",
    leadId: "tomas",
    memberIds: ["tomas", "james", "priya", "nina", "maria"],
    health: "on_track",
    targetDate: daysFromNow(70),
    colorVar: "--chart-1",
  },
];

const projectsById = new Map(demoProjects.map((p) => [p.id, p]));

export function demoProjectById(id: string): DemoProject | undefined {
  return projectsById.get(id);
}

export const healthMeta: Record<DemoProjectHealth, { label: string; colorVar: string }> = {
  on_track: { label: "On track", colorVar: "--status-done" },
  at_risk: { label: "At risk", colorVar: "--priority-urgent" },
  ahead: { label: "Ahead", colorVar: "--status-in-progress" },
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type DemoTask = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: (typeof taskStatuses)[number];
  priority: (typeof taskPriorities)[number];
  dueDate: string;
  assigneeId: string;
  tags: string[];
  points: number;
};

type TaskRow = [
  title: string,
  status: DemoTask["status"],
  priority: DemoTask["priority"],
  dueOffset: number,
  assigneeId: string,
  tags: string[],
  points: number,
  description?: string,
];

function buildTasks(projectId: string, prefix: string, rows: TaskRow[]): DemoTask[] {
  return rows.map(([title, status, priority, dueOffset, assigneeId, tags, points, description], i) => ({
    id: `demo-task-${prefix}-${i + 1}`,
    projectId,
    title,
    description: description ?? null,
    status,
    priority,
    dueDate: daysFromNow(dueOffset),
    assigneeId,
    tags,
    points,
  }));
}

export const demoTasks: DemoTask[] = [
  ...buildTasks("demo-project-website", "web", [
    ["Audit current site content", "done", "medium", -12, "maria", ["content"], 3, "Inventory pages, flag anything stale or off-brand."],
    ["Design new pricing page", "done", "high", -6, "tomas", ["design"], 5, "Three-tier layout, monthly/annual toggle."],
    ["Build pricing page with annual toggle", "in_review", "high", -1, "james", ["frontend"], 5],
    ["Migrate blog to new CMS", "in_progress", "medium", 4, "maria", ["content", "cms"], 8, "410 posts, preserve slugs and canonical URLs."],
    ["Set up staging environment", "in_progress", "urgent", 2, "leo", ["infra"], 3, "Mirror prod infra, point at the new DB."],
    ["Write launch announcement", "todo", "low", 10, "maria", ["content"], 2],
    ["QA pass on mobile breakpoints", "todo", "high", 7, "nina", ["qa"], 3, "iOS Safari and Android Chrome at minimum."],
    ["Fix broken redirects from old URLs", "todo", "urgent", -2, "james", ["frontend", "seo"], 2, "301s for the 40 highest-traffic legacy paths."],
  ]),
  ...buildTasks("demo-project-mobile", "mob", [
    ["Offline sync engine", "in_progress", "urgent", 6, "priya", ["backend", "sync"], 13, "CRDT-based merge, conflict-free across devices."],
    ["Push notification service", "in_review", "high", -1, "priya", ["backend"], 5],
    ["Redesign onboarding flow", "done", "high", -9, "tomas", ["design"], 8, "Cut sign-up steps from 7 to 3."],
    ["Biometric login (Face ID / fingerprint)", "in_progress", "high", 9, "james", ["mobile", "auth"], 5],
    ["Crash reporting and alerting", "done", "medium", -4, "nina", ["observability"], 3],
    ["App store review checklist", "todo", "medium", 20, "nina", ["release"], 2],
    ["Deep link routing", "todo", "medium", 14, "james", ["mobile"], 3],
    ["Performance: cold start under 2s", "in_progress", "urgent", -3, "priya", ["perf"], 8, "Currently 3.4s on mid-tier Android."],
  ]),
  ...buildTasks("demo-project-data", "data", [
    ["Inventory legacy pipelines", "done", "medium", -15, "aisha", ["discovery"], 5, "63 pipelines, 14 with no owner."],
    ["Stand up lakehouse dev environment", "done", "high", -10, "leo", ["infra"], 8],
    ["dbt models: core marts", "in_progress", "high", 8, "aisha", ["dbt"], 13, "Orders, revenue, retention — parity with legacy marts."],
    ["Backfill 24 months of events", "in_progress", "medium", 12, "aisha", ["migration"], 8, "2.1B rows, batched by month with checksums."],
    ["Data quality checks in CI", "in_review", "high", 2, "nina", ["quality"], 5, "Freshness, volume, and schema tests on every merge."],
    ["Deprecate nightly cron ETL", "todo", "medium", 25, "leo", ["cleanup"], 3],
    ["Access controls for finance schema", "todo", "high", 15, "sam", ["governance"], 3],
    ["Dashboard cutover comms", "todo", "low", 30, "maria", ["comms"], 2],
  ]),
  ...buildTasks("demo-project-portal", "portal", [
    ["SSO with SAML and OIDC", "done", "urgent", -8, "priya", ["auth"], 8, "Okta, Entra ID, and Google Workspace verified."],
    ["Self-serve plan upgrades", "done", "high", -3, "james", ["billing"], 8],
    ["Usage-based invoice preview", "in_review", "high", 1, "priya", ["billing"], 5, "Live proration math, matches finance to the cent."],
    ["Team management UI", "in_progress", "medium", 6, "james", ["frontend"], 5],
    ["Audit export (CSV and API)", "done", "medium", -5, "aisha", ["api"], 3],
    ["Webhooks for billing events", "in_progress", "medium", 9, "priya", ["api"], 5],
    ["Empty-state onboarding tour", "todo", "low", 16, "tomas", ["design"], 3],
    ["Load test: 10k concurrent sessions", "todo", "high", 11, "leo", ["perf"], 5],
  ]),
  ...buildTasks("demo-project-soc2", "soc2", [
    ["Map controls to policies", "done", "high", -14, "sam", ["controls"], 5, "112 controls mapped across 9 policy docs."],
    ["Evidence collection automation", "in_progress", "urgent", -1, "sam", ["automation"], 8, "Pull evidence from GitHub, AWS, and Okta on a schedule."],
    ["Vendor risk review", "in_progress", "high", 3, "maria", ["vendor"], 3],
    ["Q3 access review", "todo", "urgent", 5, "sam", ["access"], 3, "All production systems, sign-off per team lead."],
    ["Incident response tabletop", "in_review", "medium", -2, "leo", ["ir"], 2],
    ["Encryption-at-rest audit", "done", "high", -7, "priya", ["crypto"], 3],
    ["Employee security training", "todo", "medium", 8, "nina", ["training"], 2],
    ["Pen test remediation tracking", "in_progress", "high", 10, "sam", ["pentest"], 5, "11 findings: 2 high, 4 medium, 5 low."],
  ]),
  ...buildTasks("demo-project-design", "ds", [
    ["Token architecture: color, type, space", "done", "high", -20, "tomas", ["tokens"], 8],
    ["Dark mode token pass", "done", "medium", -11, "tomas", ["tokens"], 5, "Every semantic token validated against both surfaces."],
    ["Button, Input, and Select components", "in_progress", "high", 7, "tomas", ["components"], 8],
    ["Data table component", "in_progress", "medium", 13, "james", ["components"], 8, "Sorting, sticky headers, virtualized rows."],
    ["Figma library sync", "in_review", "medium", 3, "tomas", ["figma"], 3],
    ["Migration codemods", "todo", "medium", 24, "priya", ["tooling"], 5, "Auto-rewrite legacy component imports and props."],
    ["Docs site with live examples", "todo", "low", 28, "maria", ["docs"], 5],
    ["Accessibility audit (WCAG 2.2 AA)", "todo", "high", 18, "nina", ["a11y"], 5],
  ]),
];

export function demoTasksForProject(projectId: string): DemoTask[] {
  return demoTasks.filter((t) => t.projectId === projectId);
}

export function isOverdue(task: DemoTask): boolean {
  return task.status !== "done" && task.dueDate < todayIso();
}

// ---------------------------------------------------------------------------
// Pre-computed trend series (what a few months of real usage would produce)
// ---------------------------------------------------------------------------

export const velocityByWeek = [
  { week: "Jun 1", planned: 34, completed: 26 },
  { week: "Jun 8", planned: 36, completed: 31 },
  { week: "Jun 15", planned: 38, completed: 29 },
  { week: "Jun 22", planned: 40, completed: 37 },
  { week: "Jun 29", planned: 38, completed: 36 },
  { week: "Jul 6", planned: 42, completed: 41 },
  { week: "Jul 13", planned: 44, completed: 40 },
  { week: "Jul 20", planned: 44, completed: 43 },
];

export const burndownByDay = [
  { day: "Jul 14", remaining: 86, ideal: 86 },
  { day: "Jul 15", remaining: 82, ideal: 77 },
  { day: "Jul 16", remaining: 74, ideal: 69 },
  { day: "Jul 17", remaining: 71, ideal: 60 },
  { day: "Jul 18", remaining: 62, ideal: 52 },
  { day: "Jul 21", remaining: 55, ideal: 43 },
  { day: "Jul 22", remaining: 46, ideal: 34 },
  { day: "Jul 23", remaining: 41, ideal: 26 },
  { day: "Jul 24", remaining: 38, ideal: 17 },
];

export const cycleTimeByWeek = [
  { week: "Jun 1", inProgress: 4.6, inReview: 2.8 },
  { week: "Jun 8", inProgress: 4.2, inReview: 2.6 },
  { week: "Jun 15", inProgress: 4.4, inReview: 2.1 },
  { week: "Jun 22", inProgress: 3.8, inReview: 1.9 },
  { week: "Jun 29", inProgress: 3.5, inReview: 2.0 },
  { week: "Jul 6", inProgress: 3.2, inReview: 1.6 },
  { week: "Jul 13", inProgress: 3.0, inReview: 1.4 },
  { week: "Jul 20", inProgress: 2.7, inReview: 1.3 },
];

export const completedByWeekSpark = velocityByWeek.map((w) => ({ x: w.week, y: w.completed }));

// Inflow vs outflow, matching the live createdVsCompleted catalog query's
// { day, created, completed } shape.
export const createdVsCompletedByDay = [
  { day: "Jul 14", created: 6, completed: 4 },
  { day: "Jul 15", created: 3, completed: 5 },
  { day: "Jul 16", created: 5, completed: 7 },
  { day: "Jul 17", created: 4, completed: 3 },
  { day: "Jul 18", created: 7, completed: 6 },
  { day: "Jul 21", created: 2, completed: 8 },
  { day: "Jul 22", created: 5, completed: 6 },
  { day: "Jul 23", created: 4, completed: 7 },
  { day: "Jul 24", created: 3, completed: 5 },
];

export const launchReadiness = [
  { workstream: "Billing & invoicing", percent: 92 },
  { workstream: "SSO & provisioning", percent: 100 },
  { workstream: "Team management", percent: 64 },
  { workstream: "Load & performance", percent: 38 },
  { workstream: "Docs & onboarding", percent: 51 },
];

// ---------------------------------------------------------------------------
// Query catalog (in-memory stand-in for runCatalogQuery)
// ---------------------------------------------------------------------------


function enrichTask(t: DemoTask) {
  const project = demoProjectById(t.projectId);
  const assignee = demoPerson(t.assigneeId);
  return {
    ...t,
    project: project?.shortName ?? "—",
    assignee: assignee.name,
    assigneeId: assignee.id,
    tagList: t.tags.join(", "),
  };
}

function filterTasks(params: Record<string, unknown>) {
  const projectId = params.projectId as string | undefined;
  const status = params.status as string | undefined;
  const priority = params.priority as string | undefined;
  const assigneeId = params.assigneeId as string | undefined;
  const openOnly = params.open === true;
  return demoTasks
    .filter((t) => !projectId || t.projectId === projectId)
    .filter((t) => !status || t.status === status)
    .filter((t) => !priority || t.priority === priority)
    .filter((t) => !assigneeId || t.assigneeId === assigneeId)
    .filter((t) => !openOnly || t.status !== "done");
}

const statusKeys = ["todo", "in_progress", "in_review", "done"] as const;

export function runDemoQuery(
  queryId: string,
  rawParams: Record<string, unknown> = {},
  filters: Record<string, string> = {}
): Record<string, unknown>[] {
  const params = resolveBindingParams(rawParams, filters);
  const limit = (params.limit as number | undefined) ?? 100;

  switch (queryId) {
    case "tasksList":
      return filterTasks(params).slice(0, limit).map(enrichTask);

    case "overdueTasks": {
      const today = todayIso();
      return filterTasks(params)
        .filter((t) => t.status !== "done" && t.dueDate < today)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, limit)
        .map((t) => ({
          ...enrichTask(t),
          daysOverdue: Math.max(1, Math.round((Date.parse(today) - Date.parse(t.dueDate)) / 86_400_000)),
        }));
    }

    case "upcomingTasks": {
      const today = todayIso();
      const horizon = daysFromNow((params.days as number | undefined) ?? 7);
      return filterTasks(params)
        .filter((t) => t.status !== "done" && t.dueDate >= today && t.dueDate <= horizon)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, limit)
        .map(enrichTask);
    }

    case "tasksByStatusCount": {
      const tasks = filterTasks(params);
      return statusKeys.map((status) => ({
        status,
        count: tasks.filter((t) => t.status === status).length,
      }));
    }

    case "statusByProject":
      return demoProjects.map((p) => {
        const tasks = demoTasksForProject(p.id);
        const row: Record<string, unknown> = { project: p.shortName };
        for (const s of statusKeys) row[s] = tasks.filter((t) => t.status === s).length;
        return row;
      });

    case "openByAssignee": {
      const open = filterTasks(params).filter((t) => t.status !== "done");
      const byPerson = new Map<string, Record<string, number>>();
      for (const t of open) {
        const bucket = byPerson.get(t.assigneeId) ?? { todo: 0, in_progress: 0, in_review: 0 };
        bucket[t.status] = (bucket[t.status] ?? 0) + 1;
        byPerson.set(t.assigneeId, bucket);
      }
      return [...byPerson.entries()]
        .map(([id, counts]) => ({
          assignee: demoPerson(id).name.split(" ")[0],
          ...counts,
          total: Object.values(counts).reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => (b.total as number) - (a.total as number));
    }

    case "overdueByAssignee": {
      const today = todayIso();
      const overdue = filterTasks(params).filter((t) => t.status !== "done" && t.dueDate < today);
      const byPerson = new Map<string, number>();
      for (const t of overdue) byPerson.set(t.assigneeId, (byPerson.get(t.assigneeId) ?? 0) + 1);
      return [...byPerson.entries()]
        .map(([id, count]) => ({ assignee: demoPerson(id).name.split(" ")[0], count }))
        .sort((a, b) => b.count - a.count);
    }

    case "pointsByProject":
      return demoProjects
        .map((p) => ({
          project: p.shortName,
          points: demoTasksForProject(p.id)
            .filter((t) => t.status !== "done")
            .reduce((sum, t) => sum + t.points, 0),
        }))
        .sort((a, b) => b.points - a.points);

    case "velocityByWeek":
      return velocityByWeek;

    case "createdVsCompleted":
      return createdVsCompletedByDay;

    // Live agingWip buckets by createdAt, which demo tasks don't carry —
    // derive a stable stand-in from due-date offsets so the same view schema
    // renders in both worlds.
    case "agingWip": {
      const open = filterTasks(params).filter((t) => t.status !== "done");
      const buckets = ["0-3 days", "4-7 days", "8-14 days", "15-30 days", "30+ days"];
      const counts = new Map<string, number>(buckets.map((b) => [b, 0]));
      const today = todayIso();
      for (const t of open) {
        const age = Math.abs(Math.round((Date.parse(today) - Date.parse(t.dueDate)) / 86_400_000));
        const bucket =
          age <= 3 ? buckets[0] : age <= 7 ? buckets[1] : age <= 14 ? buckets[2] : age <= 30 ? buckets[3] : buckets[4];
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
      return buckets.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }));
    }

    case "burndownByDay":
      return burndownByDay;

    case "cycleTimeByWeek":
      return cycleTimeByWeek;

    case "launchReadiness":
      return launchReadiness;

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Derived stats for the projects pages
// ---------------------------------------------------------------------------

export function projectStats(projectId: string) {
  const tasks = demoTasksForProject(projectId);
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter(isOverdue).length;
  const openPoints = tasks.filter((t) => t.status !== "done").reduce((s, t) => s + t.points, 0);
  return {
    total: tasks.length,
    done,
    overdue,
    openPoints,
    inFlight: tasks.filter((t) => t.status === "in_progress" || t.status === "in_review").length,
    percentDone: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  };
}

export function portfolioStats() {
  const done = demoTasks.filter((t) => t.status === "done").length;
  const overdue = demoTasks.filter(isOverdue).length;
  return {
    projects: demoProjects.length,
    atRisk: demoProjects.filter((p) => p.health === "at_risk").length,
    tasks: demoTasks.length,
    done,
    open: demoTasks.length - done,
    overdue,
    inFlight: demoTasks.filter((t) => t.status === "in_progress" || t.status === "in_review").length,
    completedLastWeek: velocityByWeek[velocityByWeek.length - 1].completed,
    velocityDelta:
      velocityByWeek[velocityByWeek.length - 1].completed -
      velocityByWeek[velocityByWeek.length - 2].completed,
  };
}
