// The contents of a seeded workspace: the people, the projects, and the
// work. Data only — seed-sample-data.ts turns this into rows.
//
// Sized to show the product at full stretch rather than to be minimal.
// Every catalog query should return something interesting over it: several
// projects so per-project rollups have shape, a team so workload and
// assignee charts aren't one bar, and roughly three months of finished work
// so velocity, cycle time and flow are real trends instead of single points.

export type SampleTeammate = {
  // Suffixed onto the workspace id at seed time, so two workspaces never
  // collide on a user row.
  key: string;
  name: string;
  email: string;
};

export const sampleTeammates: SampleTeammate[] = [
  { key: "priya", name: "Priya Raman", email: "priya.raman@claydemo.dev" },
  { key: "marcus", name: "Marcus Webb", email: "marcus.webb@claydemo.dev" },
  { key: "dana", name: "Dana Ortiz", email: "dana.ortiz@claydemo.dev" },
  { key: "sam", name: "Sam Whitfield", email: "sam.whitfield@claydemo.dev" },
  { key: "elena", name: "Elena Cruz", email: "elena.cruz@claydemo.dev" },
];

export type SampleTask = {
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  points: number;
  // Which teammate owns it, by index into sampleTeammates. Undefined leaves
  // it unassigned, which every real backlog has some of.
  owner?: number;
  // Finished work: how many weeks ago it was completed, and how many days it
  // took. Together these give velocity and cycle time a genuine shape.
  doneWeeksAgo?: number;
  cycleDays?: number;
  // Open work: due date relative to today. Negative is overdue.
  dueInDays?: number;
  // How long it has been open, which is what the aging-WIP buckets read.
  openedDaysAgo?: number;
  // Free-form labels, which the tasksByTag catalog query counts.
  tags?: string[];
};

// Folders the sample projects are grouped into, in display order.
export const sampleFolders = [
  { name: "Customer Facing", colorVar: "--chart-1" },
  { name: "Platform", colorVar: "--chart-3" },
  { name: "Internal", colorVar: "--chart-4" },
] as const;

export type SampleProject = {
  name: string;
  description: string;
  // Index into sampleFolders. Left off for projects that sit outside every
  // folder, which any real workspace has some of.
  folder?: number;
  // Pinned projects float above the folders.
  pinned?: boolean;
  // Archived ones only appear in the archive at the bottom of the page.
  archived?: boolean;
  // Index into sampleTeammates. The lead shows in the project header.
  lead?: number;
  // Days from today the project is aiming to land.
  targetInDays?: number;
  tasks: SampleTask[];
};

export const sampleProjects: SampleProject[] = [
  {
    name: "Website Relaunch",
    folder: 0,
    pinned: true,
    lead: 0,
    targetInDays: 14,
    description: "Rebuild the marketing site and ship the new pricing page.",
    tasks: [
      { title: "Pick a CMS and get sign-off", description: "Shortlist three, cost them out, agree with marketing.", status: "done", priority: "high", points: 5, owner: 0, doneWeeksAgo: 11, cycleDays: 9 },
      { title: "Move DNS to the new provider", description: "Cut over records with a short TTL, keep the old zone warm.", status: "done", priority: "medium", points: 3, owner: 1, doneWeeksAgo: 10, cycleDays: 4 },
      { title: "Agree the new sitemap", description: "Collapse the old nav from nine sections to five.", status: "done", priority: "medium", points: 8, owner: 2, doneWeeksAgo: 8, cycleDays: 12 },
      { title: "Audit current site content", description: "Inventory pages, flag anything stale or off-brand.", status: "done", priority: "medium", points: 8, owner: 0, doneWeeksAgo: 6, cycleDays: 7 },
      { title: "Rebuild the component library", description: "Buttons, forms, cards — everything the new pages need.", status: "done", priority: "high", points: 13, owner: 3, doneWeeksAgo: 3, cycleDays: 15 },
      { title: "Design new pricing page", tags: ["design", "frontend"], description: "Three-tier layout, monthly/annual toggle.", status: "in_review", priority: "high", points: 5, owner: 2, dueInDays: -1, openedDaysAgo: 9 },
      { title: "Migrate blog to new CMS", tags: ["content", "cms"], status: "in_progress", priority: "medium", points: 8, owner: 1, dueInDays: 4, openedDaysAgo: 16 },
      { title: "Fix broken redirects from old URLs", tags: ["seo", "urgent"], status: "todo", priority: "urgent", points: 2, owner: 0, dueInDays: -3, openedDaysAgo: 22 },
      { title: "QA pass on mobile breakpoints", tags: ["qa", "mobile"], description: "iOS Safari and Android Chrome at minimum.", status: "todo", priority: "high", points: 3, owner: 4, dueInDays: 6, openedDaysAgo: 5 },
      { title: "Write launch announcement", status: "todo", priority: "low", points: 2, dueInDays: 12, openedDaysAgo: 2 },
    ],
  },
  {
    name: "Mobile App v2",
    folder: 0,
    lead: 3,
    targetInDays: 45,
    description: "Offline mode, a faster sync engine, and a refreshed shell.",
    tasks: [
      { title: "Spike: local-first storage options", status: "done", priority: "high", points: 5, owner: 3, doneWeeksAgo: 9, cycleDays: 6 },
      { title: "Ship the new tab bar", status: "done", priority: "medium", points: 8, owner: 4, doneWeeksAgo: 7, cycleDays: 11 },
      { title: "Background sync scheduler", status: "done", priority: "high", points: 13, owner: 3, doneWeeksAgo: 4, cycleDays: 18 },
      { title: "Conflict resolution for offline edits", tags: ["sync", "mobile"], description: "Last-write-wins is not going to survive contact with users.", status: "in_progress", priority: "urgent", points: 13, owner: 3, dueInDays: 8, openedDaysAgo: 24 },
      { title: "Crash-free rate back above 99.5%", tags: ["stability", "mobile"], status: "in_progress", priority: "urgent", points: 5, owner: 1, dueInDays: -2, openedDaysAgo: 31 },
      { title: "Rework onboarding carousel", tags: ["design", "mobile"], status: "in_review", priority: "medium", points: 5, owner: 2, dueInDays: 3, openedDaysAgo: 12 },
      { title: "Drop support for iOS 15", status: "todo", priority: "low", points: 3, owner: 4, dueInDays: 20, openedDaysAgo: 4 },
      { title: "Instrument sync failures", tags: ["observability"], status: "todo", priority: "high", points: 3, dueInDays: -5, openedDaysAgo: 27 },
      { title: "App Store screenshots for v2", status: "todo", priority: "medium", points: 2, owner: 2, dueInDays: 14, openedDaysAgo: 1 },
    ],
  },
  {
    name: "Billing Migration",
    folder: 1,
    pinned: true,
    lead: 1,
    targetInDays: 21,
    description: "Move off the legacy biller without dropping a single invoice.",
    tasks: [
      { title: "Reconcile legacy invoice export", status: "done", priority: "urgent", points: 8, owner: 1, doneWeeksAgo: 10, cycleDays: 14 },
      { title: "Dual-write to both systems", status: "done", priority: "urgent", points: 13, owner: 1, doneWeeksAgo: 6, cycleDays: 21 },
      { title: "Proration rules parity tests", status: "done", priority: "high", points: 8, owner: 0, doneWeeksAgo: 2, cycleDays: 9 },
      { title: "Migrate active subscriptions", tags: ["billing", "migration"], description: "Batched, reversible, with a dry run first.", status: "in_progress", priority: "urgent", points: 13, owner: 1, dueInDays: 5, openedDaysAgo: 19 },
      { title: "Dunning emails on the new provider", tags: ["billing", "email"], status: "in_review", priority: "high", points: 5, owner: 4, dueInDays: 1, openedDaysAgo: 8 },
      { title: "Decommission the legacy webhook", status: "todo", priority: "medium", points: 3, owner: 0, dueInDays: 25, openedDaysAgo: 3 },
      { title: "Finance sign-off on the first cycle", tags: ["billing"], status: "todo", priority: "high", points: 2, dueInDays: -8, openedDaysAgo: 40 },
    ],
  },
  {
    name: "Customer Onboarding",
    folder: 0,
    lead: 2,
    targetInDays: 60,
    description: "Cut time-to-first-value from days to under an hour.",
    tasks: [
      { title: "Map the current onboarding funnel", status: "done", priority: "medium", points: 5, owner: 2, doneWeeksAgo: 8, cycleDays: 5 },
      { title: "Self-serve workspace provisioning", status: "done", priority: "high", points: 13, owner: 3, doneWeeksAgo: 5, cycleDays: 16 },
      { title: "Sample data on first sign-in", status: "done", priority: "medium", points: 5, owner: 0, doneWeeksAgo: 1, cycleDays: 6 },
      { title: "In-app checklist widget", tags: ["frontend", "onboarding"], status: "in_progress", priority: "medium", points: 8, owner: 2, dueInDays: 9, openedDaysAgo: 13 },
      { title: "Rewrite the welcome email sequence", status: "todo", priority: "low", points: 3, owner: 4, dueInDays: 18, openedDaysAgo: 6 },
      { title: "Track activation in the funnel dashboard", status: "todo", priority: "medium", points: 5, dueInDays: -1, openedDaysAgo: 15 },
    ],
  },
  {
    name: "Data Platform",
    folder: 1,
    lead: 3,
    targetInDays: 30,
    description: "One warehouse, one set of definitions, no more spreadsheet forks.",
    tasks: [
      { title: "Stand up the warehouse", status: "done", priority: "high", points: 8, owner: 1, doneWeeksAgo: 12, cycleDays: 10 },
      { title: "Model the events schema", status: "done", priority: "high", points: 13, owner: 3, doneWeeksAgo: 9, cycleDays: 17 },
      { title: "Backfill two years of history", status: "done", priority: "medium", points: 8, owner: 1, doneWeeksAgo: 5, cycleDays: 8 },
      { title: "Agree company-wide metric definitions", tags: ["data"], description: "Two teams currently disagree on what 'active' means.", status: "in_review", priority: "high", points: 5, owner: 0, dueInDays: 2, openedDaysAgo: 21 },
      { title: "Nightly freshness alerts", tags: ["data", "observability"], status: "in_progress", priority: "medium", points: 5, owner: 3, dueInDays: 11, openedDaysAgo: 7 },
      { title: "Deprecate the old reporting sheet", status: "todo", priority: "low", points: 2, owner: 4, dueInDays: 30, openedDaysAgo: 2 },
      { title: "Row-level access for customer data", tags: ["data", "security"], status: "todo", priority: "urgent", points: 8, dueInDays: -4, openedDaysAgo: 35 },
    ],
  },
  {
    name: "Search & Discovery",
    folder: 1,
    lead: 1,
    // Deliberately behind: past its target with open work, so the health
    // badge has an off-track example to render.
    targetInDays: -6,
    description: "Replace the creaking search index before it falls over.",
    tasks: [
      { title: "Benchmark the current index", status: "done", priority: "high", points: 5, owner: 1, doneWeeksAgo: 6, cycleDays: 8, tags: ["search"] },
      { title: "Reindex pipeline rewrite", status: "in_progress", priority: "urgent", points: 13, owner: 1, dueInDays: -9, openedDaysAgo: 34, tags: ["search", "urgent"] },
      { title: "Typo tolerance and synonyms", status: "in_progress", priority: "high", points: 8, owner: 3, dueInDays: -3, openedDaysAgo: 20, tags: ["search"] },
      { title: "Relevance scoring review", status: "todo", priority: "high", points: 5, dueInDays: -1, openedDaysAgo: 17, tags: ["search"] },
      { title: "Cut over read traffic", status: "todo", priority: "urgent", points: 8, owner: 1, dueInDays: 6, openedDaysAgo: 5, tags: ["search", "infra"] },
    ],
  },
  {
    name: "Q1 Marketing Site",
    folder: 2,
    lead: 2,
    // Finished and put away — the archive would otherwise be empty, and an
    // empty archive teaches nobody that it exists.
    archived: true,
    description: "Last quarter's campaign pages. Shipped and wrapped up.",
    tasks: [
      { title: "Campaign landing page", status: "done", priority: "high", points: 8, owner: 2, doneWeeksAgo: 14, cycleDays: 10, tags: ["marketing"] },
      { title: "Pricing experiment copy", status: "done", priority: "medium", points: 3, owner: 0, doneWeeksAgo: 13, cycleDays: 5, tags: ["marketing", "content"] },
      { title: "Post-campaign writeup", status: "done", priority: "low", points: 2, owner: 2, doneWeeksAgo: 12, cycleDays: 4, tags: ["marketing"] },
    ],
  },
  {
    name: "Design System",
    folder: 2,
    lead: 4,
    targetInDays: 75,
    description: "One vocabulary of components, documented and adopted.",
    tasks: [
      { title: "Audit component drift across surfaces", status: "done", priority: "medium", points: 5, owner: 2, doneWeeksAgo: 7, cycleDays: 7 },
      { title: "Token pipeline from Figma", status: "done", priority: "high", points: 8, owner: 4, doneWeeksAgo: 3, cycleDays: 13 },
      { title: "Dark mode audit", tags: ["design"], status: "in_progress", priority: "medium", points: 5, owner: 2, dueInDays: 7, openedDaysAgo: 10 },
      { title: "Accessibility pass on form controls", tags: ["a11y", "frontend"], description: "Keyboard paths and focus order, not just contrast.", status: "in_progress", priority: "high", points: 8, owner: 4, dueInDays: -6, openedDaysAgo: 29 },
      { title: "Publish the component docs site", tags: ["docs", "design"], status: "todo", priority: "medium", points: 5, owner: 2, dueInDays: 16, openedDaysAgo: 4 },
      { title: "Retire the legacy button variants", status: "todo", priority: "low", points: 3, dueInDays: 22, openedDaysAgo: 1 },
    ],
  },
];

// Comments, so the task detail panel and the activity feed have something
// human in them. Addressed by task title so the fixture doesn't depend on
// generated ids.
export const sampleComments: { taskTitle: string; author: number; body: string }[] = [
  { taskTitle: "Conflict resolution for offline edits", author: 0, body: "Last-write-wins loses edits when two devices are offline at once. Can we scope a CRDT spike before committing to the deadline?" },
  { taskTitle: "Conflict resolution for offline edits", author: 3, body: "Agreed. I'll timebox it to three days and write up what we find." },
  { taskTitle: "Migrate active subscriptions", author: 1, body: "Dry run over the staging copy came back clean — 4,812 subscriptions, no proration drift." },
  { taskTitle: "Agree company-wide metric definitions", author: 2, body: "Growth and Support are both using 'active' but meaning different things. Putting 30 minutes in for Thursday." },
  { taskTitle: "Crash-free rate back above 99.5%", author: 1, body: "Down to one repeating crash, in the sync scheduler. Fix is in review." },
  { taskTitle: "Accessibility pass on form controls", author: 4, body: "Focus order is wrong on every multi-step form. Bigger than the estimate — flagging now rather than at the end." },
  { taskTitle: "Fix broken redirects from old URLs", author: 0, body: "Search console is showing 340 404s a day. This should jump the queue." },
];


// Agent conversations seeded into the demo, so the chat page shows real
// history rather than an empty panel. These are stored as ordinary
// agent_messages rows — the same shape a live run writes — and the view each
// one produced is linked by name.
export type SampleConversation = {
  title: string;
  viewName?: string;
  daysAgo: number;
  turns: { role: "user" | "assistant"; text: string }[];
};

export const sampleConversations: SampleConversation[] = [
  {
    title: "Build me a delivery dashboard: open work, overdue risk, and where things stand",
    viewName: "Delivery Overview",
    daysAgo: 6,
    turns: [
      {
        role: "user",
        text: "Build me a delivery dashboard: open work, overdue risk, and where things stand.",
      },
      {
        role: "assistant",
        text: "Built it. I led with three counts — open, overdue, waiting on review — then a stacked bar of status per project so you can see which one is carrying the risk, and a donut of where the remaining effort sits. Overdue is styled as a danger figure since any non-zero value there is a problem.",
      },
      { role: "user", text: "Add velocity to it — I want to see whether we're speeding up." },
      {
        role: "assistant",
        text: "Added a points-shipped tile with a sparkline and a week-over-week change. It reads velocityByWeek, so the trend is computed from the same rows the number comes from rather than being decorative.",
      },
    ],
  },
  {
    title: "Which project is most behind?",
    daysAgo: 4,
    turns: [
      { role: "user", text: "Which project is most behind? Just tell me, don't build anything." },
      {
        role: "assistant",
        text: "Mobile App v2. It has two overdue tasks against a 45-day target, and both are urgent — the crash-free rate work is 31 days open and offline conflict resolution is 24. Billing Migration has one overdue item but it's a sign-off, not engineering work.",
      },
    ],
  },
  {
    title: "Who is carrying what right now?",
    viewName: "Team Workload",
    daysAgo: 3,
    turns: [
      { role: "user", text: "Who is carrying what right now, and who is closest to overloaded?" },
      {
        role: "assistant",
        text: "Here's open work per person, split by status, next to the total points in flight. I also dropped in a table of everything in progress with live status dropdowns, so you can move things off someone without leaving the view.",
      },
    ],
  },
  {
    title: "How fast are we going, and is cycle time getting better or worse?",
    viewName: "Velocity & Flow",
    daysAgo: 2,
    turns: [
      { role: "user", text: "How fast are we going, and is our cycle time getting better or worse?" },
      {
        role: "assistant",
        text: "Two trend tiles and three charts. Velocity is trending up; cycle time is trending down, which is the good direction for that one — so its arrow is green while pointing down. Created-vs-completed is there too, since velocity alone won't tell you if you're falling behind on inflow.",
      },
    ],
  },
];
