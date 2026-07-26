import { z } from "zod";

export const widgetTypes = [
  "table",
  "kpi",
  "chart",
  "filterBar",
  "form",
  "text",
  "computedField",
  "progress",
] as const;
export type WidgetType = (typeof widgetTypes)[number];

// Scalar-only params: keeps the DSL JSON-serializable and keeps the "$filter:x"
// placeholder mechanism (see ViewRenderer) simple to detect and resolve.
const jsonScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const dataBindingSchema = z.object({
  // Must resolve to an entry in the query catalog — never raw SQL, never
  // agent-authored code. Enforced again server-side on every propose/run.
  queryId: z.string().min(1),
  params: z.record(z.string(), jsonScalar).default({}),
});
export type DataBinding = z.infer<typeof dataBindingSchema>;

const baseWidget = {
  id: z.string().min(1),
  title: z.string().max(200).optional(),
};

// Optional presentation hint per column: status/priority render as badges,
// date gets overdue highlighting, number right-aligns with tabular figures.
export const tableColumnKinds = ["text", "status", "priority", "date", "number"] as const;

export const tableWidgetSchema = z.object({
  ...baseWidget,
  type: z.literal("table"),
  dataBinding: dataBindingSchema,
  config: z.object({
    columns: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          kind: z.enum(tableColumnKinds).optional(),
        })
      )
      .min(1)
      .max(10),
    // Status columns become live dropdowns backed by the mutation catalog's
    // updateTaskStatus. The agent may set this flag, but the mutation only
    // ever fires when a signed-in user clicks — under that user's session,
    // through the same org-scoped choke point as every other write.
    statusActions: z.boolean().optional(),
  }),
});

const aggregateConfig = z.object({
  field: z.string().optional(),
  aggregate: z.enum(["count", "sum", "avg"]).default("count"),
  label: z.string().min(1).max(100),
  format: z.enum(["number", "percent"]).default("number"),
  // A short static caption under the value ("across 3 projects").
  note: z.string().max(200).optional(),
  // "danger" renders the value in the destructive color — for figures where
  // a non-zero value is a problem (overdue counts, blockers).
  intent: z.enum(["default", "danger"]).optional(),
});

export const kpiWidgetSchema = z.object({
  ...baseWidget,
  type: z.literal("kpi"),
  dataBinding: dataBindingSchema,
  config: aggregateConfig,
});

// Same shape as kpi today (a single aggregated figure); kept as a distinct
// DSL type because it's the natural extension point for cross-query
// formulas later, without disturbing kpi's contract.
export const computedFieldWidgetSchema = z.object({
  ...baseWidget,
  type: z.literal("computedField"),
  dataBinding: dataBindingSchema,
  config: aggregateConfig,
});

// Only design tokens, never raw CSS — the renderer wraps this in var(...).
const colorVarPattern = /^--[a-z0-9-]+$/;

export const chartSeriesSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1).max(60),
  colorVar: z.string().regex(colorVarPattern).optional(),
  // Dashed series render as reference lines (planned, ideal pace, targets).
  dashed: z.boolean().optional(),
});

export const chartWidgetSchema = z
  .object({
    ...baseWidget,
    type: z.literal("chart"),
    dataBinding: dataBindingSchema,
    config: z.object({
      chartType: z.enum(["bar", "line", "area", "stackedBar", "stackedArea", "donut"]),
      // Cartesian charts: xField is the category/time axis. Single series can
      // use yField alone; multi-series charts list series explicitly (each key
      // is a numeric field on the query's rows).
      xField: z.string().optional(),
      yField: z.string().optional(),
      series: z.array(chartSeriesSchema).min(1).max(5).optional(),
      // Donut charts only.
      donut: z
        .object({
          nameField: z.string(),
          valueField: z.string(),
          centerLabel: z.string().max(40).optional(),
          maxSlices: z.number().int().min(2).max(5).optional(),
        })
        .optional(),
    }),
  })
  .superRefine((widget, ctx) => {
    const { chartType, xField, yField, series, donut } = widget.config;
    if (chartType === "donut") {
      if (!donut) {
        ctx.addIssue({ code: "custom", message: 'chartType "donut" requires config.donut' });
      }
      return;
    }
    if (!xField) {
      ctx.addIssue({ code: "custom", message: `chartType "${chartType}" requires config.xField` });
    }
    if (!yField && (!series || series.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: `chartType "${chartType}" requires config.yField or config.series`,
      });
    }
  });

// Labeled percentage meters, one per row of the bound query (e.g. readiness
// or completion percent by project/workstream). valueField must be 0-100.
export const progressWidgetSchema = z.object({
  ...baseWidget,
  type: z.literal("progress"),
  dataBinding: dataBindingSchema,
  config: z.object({
    nameField: z.string(),
    valueField: z.string(),
  }),
});

export const filterBarWidgetSchema = z.object({
  ...baseWidget,
  type: z.literal("filterBar"),
  config: z.object({
    filterKey: z.string().min(1),
    label: z.string().min(1).max(100),
    options: z.array(z.object({ label: z.string(), value: z.string() })).min(1).max(20),
  }),
});

export const textWidgetSchema = z.object({
  ...baseWidget,
  type: z.literal("text"),
  config: z.object({
    content: z.string().max(2000),
  }),
});

// Deliberately narrow: the only supported action is the existing,
// org-scoped tasks.create mutation. This is not a generic form builder —
// widening it means designing a mutation catalog with the same
// org-scoping guarantees the query catalog has, which is future work.
export const formWidgetSchema = z.object({
  ...baseWidget,
  type: z.literal("form"),
  config: z.object({
    action: z.literal("createTask"),
    projectId: z.string().uuid(),
  }),
});

export const widgetSchema = z.discriminatedUnion("type", [
  tableWidgetSchema,
  kpiWidgetSchema,
  computedFieldWidgetSchema,
  chartWidgetSchema,
  filterBarWidgetSchema,
  textWidgetSchema,
  formWidgetSchema,
  progressWidgetSchema,
]);
export type Widget = z.infer<typeof widgetSchema>;

export const layoutItemSchema = z.object({
  id: z.string().min(1),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
});
export type LayoutItem = z.infer<typeof layoutItemSchema>;

export const viewScopeValues = ["personal", "org"] as const;

export const viewSchema = z
  .object({
    name: z.string().min(1).max(200),
    scope: z.enum(viewScopeValues).default("personal"),
    layout: z.object({
      widgets: z.array(layoutItemSchema).max(24),
    }),
    widgets: z.array(widgetSchema).min(1).max(24),
  })
  .superRefine((view, ctx) => {
    const widgetIds = view.widgets.map((w) => w.id);
    const uniqueWidgetIds = new Set(widgetIds);
    if (uniqueWidgetIds.size !== widgetIds.length) {
      ctx.addIssue({ code: "custom", message: "Widget ids must be unique" });
    }

    const layoutIds = new Set(view.layout.widgets.map((w) => w.id));
    for (const id of uniqueWidgetIds) {
      if (!layoutIds.has(id)) {
        ctx.addIssue({ code: "custom", message: `Widget "${id}" is missing a layout entry` });
      }
    }
  });
export type ViewInput = z.infer<typeof viewSchema>;
