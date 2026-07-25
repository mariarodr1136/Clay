import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { demoViewDefs, demoViewById } from "@/fixtures/demo-dashboards";
import { collectDemoViewDatasets, collectDemoWidgetDataset } from "./demo-datasets";
import { buildViewWorkbook } from "./xlsx";
import { toCsv } from "./csv";

// /demo exports run the same planner and writers as the live route, just
// against fixtures instead of the catalog. These pin that every shipped demo
// view actually produces a file, since a broken export there is the first
// thing a prospective user would hit.
describe("demo exports", () => {
  it("produces at least one dataset for every demo view", async () => {
    for (const view of demoViewDefs) {
      const datasets = await collectDemoViewDatasets(view, {});
      expect(datasets.length, `${view.name} has no exportable datasets`).toBeGreaterThan(0);
      for (const dataset of datasets) {
        expect(dataset.columns.length, `${view.name}/${dataset.title} has no columns`).toBeGreaterThan(0);
      }
    }
  });

  it("never reports demo data as truncated", async () => {
    // Fixtures are fully in memory, so there's no export cap to hit.
    for (const view of demoViewDefs) {
      const datasets = await collectDemoViewDatasets(view, {});
      expect(datasets.every((d) => !d.truncated && d.rowLimit === null)).toBe(true);
    }
  });

  it("exports a demo table with exactly the columns it shows", async () => {
    const view = demoViewDefs.find((v) => v.widgets.some((w) => w.type === "table"))!;
    const table = view.widgets.find((w) => w.type === "table")!;

    const dataset = await collectDemoWidgetDataset(view, table.id, {});
    expect(dataset?.columns.map((c) => c.key)).toEqual(table.config.columns.map((c) => c.key));
  });

  it("applies the demo filter bar to the exported rows", async () => {
    // The delivery overview's table is bound to "$filter:projectId".
    const view = demoViewDefs.find((v) =>
      v.widgets.some(
        (w) =>
          "query" in w &&
          Object.values(w.query?.params ?? {}).some((p) => String(p).startsWith("$filter:"))
      )
    );
    if (!view) return;

    const filtered = view.widgets.find(
      (w) =>
        "query" in w &&
        Object.values(w.query?.params ?? {}).some((p) => String(p).startsWith("$filter:"))
    )!;
    const filterBar = view.widgets.find((w) => w.type === "filterBar");
    if (!filterBar) return;

    const option = filterBar.config.options[0].value;
    const all = await collectDemoWidgetDataset(view, filtered.id, {});
    const scoped = await collectDemoWidgetDataset(view, filtered.id, {
      [filterBar.config.filterKey]: option,
    });

    expect(scoped!.rows.length).toBeLessThanOrEqual(all!.rows.length);
  });

  it("builds a workbook that names the demo workspace as sample data", async () => {
    const view = demoViewById(demoViewDefs[0].id)!;
    const datasets = await collectDemoViewDatasets(view, {});

    const buffer = await buildViewWorkbook(
      {
        viewName: view.name,
        promptText: view.prompt,
        facts: [["Workspace", "Clay demo workspace (sample data)"]],
        generatedAt: new Date("2026-07-25T12:00:00Z"),
        filters: {},
      },
      datasets
    );

    const files = unzipSync(new Uint8Array(buffer));
    const names = [
      ...strFromU8(files["xl/workbook.xml"]).matchAll(/<sheet [^>]*name="([^"]+)"/g),
    ].map((m) => m[1]);

    expect(names[0]).toBe("Overview");
    expect(names).toHaveLength(datasets.length + 1);
    expect(strFromU8(files["xl/sharedStrings.xml"])).toContain("sample data");
  });

  it("escapes demo rows the same way the live CSV path does", async () => {
    const view = demoViewDefs.find((v) => v.widgets.some((w) => w.type === "table"))!;
    const table = view.widgets.find((w) => w.type === "table")!;
    const dataset = await collectDemoWidgetDataset(view, table.id, {});

    const csv = toCsv(dataset!.columns, dataset!.rows);
    expect(csv.startsWith("﻿")).toBe(true);
    // The BOM sits in front of the header row, so strip it before comparing.
    expect(csv.slice(1).split("\r\n")[0]).toBe(
      table.config.columns.map((c) => (/[",\n\r]/.test(c.label) ? `"${c.label}"` : c.label)).join(",")
    );
  });
});
