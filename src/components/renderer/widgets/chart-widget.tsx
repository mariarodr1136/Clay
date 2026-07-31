"use client";

import type { z } from "zod";
import type { chartWidgetSchema } from "@/lib/dsl/schema";
import { useCatalogQuery } from "../use-catalog-query";
import {
  CartesianChartCore,
  ChartLegend,
  DonutChartCore,
  type CartesianVariant,
  type ChartSeriesDef,
} from "@/components/charts/chart-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChartWidget({
  widget,
  filters,
}: {
  widget: z.infer<typeof chartWidgetSchema>;
  filters: Record<string, string>;
}) {
  const query = useCatalogQuery(widget.dataBinding, filters);
  const rows = (query.data ?? []) as Record<string, unknown>[];
  const { chartType, xField, yField, donut } = widget.config;

  // Multi-series charts declare series explicitly; the yField shorthand
  // (and every view saved before series existed) becomes a single series.
  const series: ChartSeriesDef[] =
    widget.config.series && widget.config.series.length > 0
      ? widget.config.series
      : [{ key: yField ?? "count", label: widget.title ?? yField ?? "Value" }];
  const showLegend = chartType !== "donut" && series.length > 1;
  const titleId = `chart-title-${widget.id}`;

  return (
    // A dashboard is a page of these; making each one a named region is what
    // lets a screen reader user jump between them rather than walking the
    // whole grid. Falls back to no role when there's no title to name it
    // with, since an unnamed region is just noise in the landmark list.
    <Card
      className="flex h-full flex-col gap-3"
      role={widget.title ? "region" : undefined}
      aria-labelledby={widget.title ? titleId : undefined}
    >
      {(widget.title || showLegend) && (
        <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          {widget.title && (
            <CardTitle id={titleId} className="min-w-0 text-sm">
              {widget.title}
            </CardTitle>
          )}
          {showLegend && <ChartLegend series={series} />}
        </CardHeader>
      )}
      <CardContent className="min-h-0 flex-1">
        {query.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {query.error && <p className="text-destructive text-sm">{query.error.message}</p>}
        {query.data && rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No data.</p>
        )}
        {query.data && rows.length > 0 && (
          chartType === "donut" ? (
            donut && (
              <DonutChartCore
                rows={rows}
                nameField={donut.nameField}
                valueField={donut.valueField}
                centerLabel={donut.centerLabel}
                maxSlices={donut.maxSlices}
              />
            )
          ) : (
            <CartesianChartCore
              variant={chartType as CartesianVariant}
              xField={xField ?? ""}
              series={series}
              rows={rows}
              title={widget.title}
            />
          )
        )}
      </CardContent>
    </Card>
  );
}
