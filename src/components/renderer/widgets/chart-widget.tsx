"use client";

import type { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { chartWidgetSchema } from "@/lib/dsl/schema";
import { useCatalogQuery } from "../use-catalog-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

export function ChartWidget({
  widget,
  filters,
}: {
  widget: z.infer<typeof chartWidgetSchema>;
  filters: Record<string, string>;
}) {
  const query = useCatalogQuery(widget.dataBinding, filters);
  const rows = (query.data ?? []) as Record<string, unknown>[];
  const { xField, yField, chartType } = widget.config;

  return (
    <Card className="flex h-full flex-col">
      {widget.title && (
        <CardHeader>
          <CardTitle className="text-sm">{widget.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="min-h-0 flex-1">
        {query.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {query.error && <p className="text-destructive text-sm">{query.error.message}</p>}
        {query.data && rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No data.</p>
        )}
        {query.data && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            {chartType === "bar" ? (
              <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey={xField}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={axisTick}
                />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <Bar dataKey={yField} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            ) : (
              <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey={xField}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={axisTick}
                />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
                <Line
                  dataKey={yField}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
