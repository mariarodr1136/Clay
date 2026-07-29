import { describe, expect, it } from "vitest";
import { buildDemoViews } from "./sample-views";
import { parseView } from "@/lib/dsl/validate";
import { findViewProblems } from "@/lib/dsl/quality";
import { queryCatalog, timeSeriesQueryIds } from "@/server/data-access/catalog";

// The seeded views are the first thing a demo visitor and a new signup see,
// and they're hand-authored — so nothing else would catch a typo'd query id
// or two widgets landing on the same grid cells. They are held to exactly
// the bar the agent's own output has to clear.
// A well-formed v4 UUID: zod checks the version and variant nibbles, so a
// naive run of 1s is rejected.
const views = buildDemoViews("11111111-1111-4111-8111-111111111111");
const timeSeries = timeSeriesQueryIds();

describe("seeded sample views", () => {
  it("ships enough to show the product at full stretch", () => {
    expect(views.length).toBeGreaterThanOrEqual(8);
    expect(new Set(views.map((v) => v.key)).size).toBe(views.length);
  });

  it.each(views.map((v) => [v.key, v] as const))("%s is a valid view", (_key, view) => {
    const parsed = parseView(view.schema);
    expect(parsed.success, parsed.success ? "" : parsed.error).toBe(true);
  });

  it.each(views.map((v) => [v.key, v] as const))(
    "%s has no structural problems",
    (_key, view) => {
      const parsed = parseView(view.schema);
      if (!parsed.success) throw new Error(parsed.error);
      const problems = findViewProblems(parsed.data, { timeSeriesQueryIds: timeSeries });
      // Warnings are allowed; errors are the same ones propose_view rejects.
      expect(problems.filter((p) => p.severity === "error")).toEqual([]);
    }
  );

  it.each(views.map((v) => [v.key, v] as const))(
    "%s only binds to real catalog queries, with valid params",
    (_key, view) => {
      const parsed = parseView(view.schema);
      if (!parsed.success) throw new Error(parsed.error);

      for (const widget of parsed.data.widgets) {
        if (!("dataBinding" in widget)) continue;
        const entry = queryCatalog[widget.dataBinding.queryId as keyof typeof queryCatalog];
        expect(entry, `${widget.id} binds to unknown query "${widget.dataBinding.queryId}"`).toBeDefined();

        // Filter placeholders ("$filter:project") are resolved at render
        // time, so they can't be validated against the schema here.
        const params = Object.fromEntries(
          Object.entries(widget.dataBinding.params ?? {}).filter(
            ([, value]) => !(typeof value === "string" && value.startsWith("$filter:"))
          )
        );
        const result = entry.paramsSchema.safeParse(params);
        expect(
          result.success,
          result.success ? "" : `${widget.id}: ${result.error?.issues.map((i) => i.message).join("; ")}`
        ).toBe(true);
      }
    }
  );

  it("covers the whole widget vocabulary between them", () => {
    const types = new Set(
      views.flatMap((view) => {
        const parsed = parseView(view.schema);
        return parsed.success ? parsed.data.widgets.map((w) => w.type) : [];
      })
    );
    // A demo that only ever shows tables and KPIs undersells the product.
    for (const expected of ["kpi", "chart", "table", "filterBar", "text"]) {
      expect(types.has(expected as never), `no ${expected} widget in any seeded view`).toBe(true);
    }
  });

  it("shows off the features that are easy to miss", () => {
    const json = JSON.stringify(views);
    // A table you can act from, a computed trend, and a donut.
    expect(json).toContain('"statusActions":true');
    expect(json).toContain('"trend"');
    expect(json).toContain('"donut"');
  });
});
