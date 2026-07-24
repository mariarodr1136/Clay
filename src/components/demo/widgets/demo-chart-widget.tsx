"use client";

import type { DemoWidget } from "@/fixtures/demo-dashboards";
import { runDemoQuery } from "@/fixtures/demo-data";
import { CartesianChartCore, ChartLegend, DonutChartCore } from "@/components/charts/chart-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartWidget = Extract<DemoWidget, { type: "chart" }>;

export function DemoChartWidget({
  widget,
  filters,
}: {
  widget: ChartWidget;
  filters: Record<string, string>;
}) {
  const rows = runDemoQuery(widget.query.queryId, widget.query.params ?? {}, filters);
  const { variant, xField, series = [], donut } = widget.config;
  const showLegend = variant !== "donut" && series.length > 1;

  return (
    <Card className="flex h-full flex-col gap-3">
      {(widget.title || showLegend) && (
        <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            {widget.title && <CardTitle className="text-sm">{widget.title}</CardTitle>}
            {widget.description && (
              <p className="text-muted-foreground mt-0.5 text-xs">{widget.description}</p>
            )}
          </div>
          {showLegend && <ChartLegend series={series} />}
        </CardHeader>
      )}
      <CardContent className="min-h-0 flex-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data.</p>
        ) : variant === "donut" ? (
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
            variant={variant}
            xField={xField ?? ""}
            series={series}
            rows={rows}
          />
        )}
      </CardContent>
    </Card>
  );
}
