import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { db } from "@/server/db/client";
import { organizations, users, projects, tasks } from "@/server/db/schema";
import type { ViewInput } from "@/lib/dsl/schema";
import { collectViewDatasets, collectWidgetDataset } from "./datasets";
import { buildViewWorkbook } from "./xlsx";
import { preloadViewQueries } from "./preload";
import { stableQueryKey } from "@/lib/dsl/query-key";

// Exports are a second consumer of the query catalog, so they inherit its
// org-scoping guarantee — but only if they really do go through it. These
// tests pin that, plus the two behaviours that make an export trustworthy:
// bindings that share a query collapse into one dataset, and the filter bar
// still applies.
describe("view exports", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let userA: typeof users.$inferSelect;
  let userB: typeof users.$inferSelect;
  let projectA: typeof projects.$inferSelect;
  let projectB: typeof projects.$inferSelect;

  const view: ViewInput = {
    name: "Export Test View",
    scope: "personal",
    layout: {
      widgets: [
        { id: "t1", x: 0, y: 0, w: 6, h: 3 },
        { id: "k1", x: 6, y: 0, w: 3, h: 2 },
        { id: "c1", x: 0, y: 3, w: 6, h: 3 },
        { id: "t2", x: 6, y: 3, w: 6, h: 3 },
      ],
    },
    widgets: [
      {
        id: "t1",
        type: "table",
        title: "All tasks",
        dataBinding: { queryId: "tasksList", params: {} },
        config: {
          columns: [
            { key: "title", label: "Task" },
            { key: "status", label: "Status", kind: "status" },
          ],
        },
      },
      {
        id: "k1",
        type: "kpi",
        title: "Total",
        // Same binding as t1 on purpose.
        dataBinding: { queryId: "tasksList", params: {} },
        config: { label: "Total tasks", aggregate: "count", format: "number" },
      },
      {
        id: "c1",
        type: "chart",
        title: "By status",
        dataBinding: { queryId: "tasksByStatusCount", params: {} },
        config: { chartType: "bar", xField: "status", yField: "count" },
      },
      {
        id: "t2",
        type: "table",
        title: "Filtered tasks",
        dataBinding: { queryId: "tasksList", params: { status: "$filter:status" } },
        config: { columns: [{ key: "title", label: "Task" }] },
      },
    ],
  };

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Export Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Export Org B" }).returning();

    [userA] = await db
      .insert(users)
      .values({ id: "export_user_a", email: "ea@example.com", name: "Export A" })
      .returning();
    [userB] = await db
      .insert(users)
      .values({ id: "export_user_b", email: "eb@example.com", name: "Export B" })
      .returning();

    [projectA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Export Project A", createdBy: userA.id })
      .returning();
    [projectB] = await db
      .insert(projects)
      .values({ organizationId: orgB.id, name: "Export Project B", createdBy: userB.id })
      .returning();

    await db.insert(tasks).values([
      {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "A: todo one",
        status: "todo",
        priority: "high",
        createdBy: userA.id,
      },
      {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "A: done one",
        status: "done",
        priority: "low",
        createdBy: userA.id,
      },
      {
        organizationId: orgB.id,
        projectId: projectB.id,
        title: "B: todo one",
        status: "todo",
        priority: "urgent",
        createdBy: userB.id,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, userA.id));
    await db.delete(users).where(eq(users.id, userB.id));
  });

  it("collapses widgets that share a binding into a single dataset", async () => {
    const datasets = await collectViewDatasets(orgA.id, view, {});

    // t1, k1 and t2 all resolve to the same query and params — an unset
    // "$filter:status" drops the param entirely — so they're genuinely one
    // dataset here, not three copies of the same sheet.
    expect(datasets).toHaveLength(2);
    const shared = datasets.find((d) => d.queryId === "tasksList");
    expect(shared?.widgetIds).toEqual(["t1", "k1", "t2"]);
  });

  it("splits a shared binding again once a filter makes the params differ", async () => {
    const datasets = await collectViewDatasets(orgA.id, view, { status: "todo" });
    const tasksListDatasets = datasets.filter((d) => d.queryId === "tasksList");

    expect(datasets).toHaveLength(3);
    expect(tasksListDatasets.map((d) => d.widgetIds)).toEqual([["t1", "k1"], ["t2"]]);
  });

  it("never includes another org's rows", async () => {
    const datasets = await collectViewDatasets(orgA.id, view, {});
    const titles = datasets
      .filter((d) => d.queryId === "tasksList")
      .flatMap((d) => d.rows.map((r) => r.title as string));

    expect(titles).toContain("A: todo one");
    expect(titles.some((t) => t.startsWith("B:"))).toBe(false);
  });

  it("leads with the columns the widget shows, then the query's other fields", async () => {
    const datasets = await collectViewDatasets(orgA.id, view, {});
    const shared = datasets.find((d) => d.widgetIds.includes("t1"));

    expect(shared?.columns.slice(0, 2)).toEqual([
      { key: "title", label: "Task" },
      { key: "status", label: "Status" },
    ]);
    expect(shared?.columns.some((c) => c.key === "priority")).toBe(true);
  });

  it("applies the view's live filter state", async () => {
    const all = await collectWidgetDataset(orgA.id, view, "t2", {});
    expect(all?.rows).toHaveLength(2);

    const filtered = await collectWidgetDataset(orgA.id, view, "t2", { status: "todo" });
    expect(filtered?.rows.map((r) => r.title)).toEqual(["A: todo one"]);
  });

  it("exports a single widget with exactly its own columns", async () => {
    const dataset = await collectWidgetDataset(orgA.id, view, "t2", {});
    expect(dataset?.columns).toEqual([{ key: "title", label: "Task" }]);
  });

  it("reports rows as complete when the export cap wasn't reached", async () => {
    const datasets = await collectViewDatasets(orgA.id, view, {});
    expect(datasets.every((d) => d.truncated === false)).toBe(true);
  });

  it("preloads print queries under the keys the widgets look them up by", async () => {
    // The print page has no session, so widgets read rows out of this map
    // instead of calling tRPC. If the keys don't line up, every widget
    // silently renders empty and the PDF comes out blank.
    const preloaded = await preloadViewQueries(orgA.id, view, {});

    const tasksKey = stableQueryKey("tasksList", {});
    expect(Object.keys(preloaded)).toContain(tasksKey);
    expect(Object.keys(preloaded)).toContain(stableQueryKey("tasksByStatusCount", {}));

    const titles = preloaded[tasksKey].map((r) => r.title as string);
    expect(titles).toContain("A: todo one");
    expect(titles.some((t) => t.startsWith("B:"))).toBe(false);
  });

  it("preloads filtered rows when the print request carries filters", async () => {
    const preloaded = await preloadViewQueries(orgA.id, view, { status: "todo" });
    const filteredKey = stableQueryKey("tasksList", { status: "todo" });

    expect(preloaded[filteredKey].map((r) => r.title)).toEqual(["A: todo one"]);
  });

  it("builds a readable workbook with a cover sheet and one sheet per dataset", async () => {
    const datasets = await collectViewDatasets(orgA.id, view, {});
    const buffer = await buildViewWorkbook(
      {
        viewName: view.name,
        promptText: "show me everything",
        facts: [
          ["Workspace", orgA.name],
          ["Current version by", "agent"],
        ],
        generatedAt: new Date("2026-07-25T12:00:00Z"),
        filters: { status: "todo" },
      },
      datasets
    );

    // An .xlsx is a zip of XML parts, so unzipping it verifies we produced a
    // real workbook rather than trusting the writer's own reader to agree.
    const files = unzipSync(new Uint8Array(buffer));
    const text = (path: string) => strFromU8(files[path]);

    expect(Object.keys(files)).toContain("xl/workbook.xml");

    const names = [...text("xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(
      (m) => m[1]
    );
    expect(names[0]).toBe("Overview");
    expect(names).toHaveLength(datasets.length + 1);
    expect(names).toContain("All tasks");

    // Cell text lives in the shared string table. The prompt and the filters
    // are what make an agent-built dashboard auditable after the fact.
    const strings = text("xl/sharedStrings.xml");
    expect(strings).toContain("show me everything");
    expect(strings).toContain("status = todo");
    expect(strings).toContain("Export Test View");
    expect(strings).toContain("All rows");

    // Sheet 2 is the first data sheet: header row + 2 org A tasks.
    const rows = [...text("xl/worksheets/sheet2.xml").matchAll(/<row /g)];
    expect(rows).toHaveLength(3);
  });
});
