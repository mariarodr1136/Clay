"use client";

import { useId } from "react";
import type { z } from "zod";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { kpiWidgetSchema, computedFieldWidgetSchema } from "@/lib/dsl/schema";
import { computeTrend } from "@/lib/dsl/trend";
import { useCatalogQuery } from "../use-catalog-query";
import { Card, CardContent } from "@/components/ui/card";

function aggregate(
  rows: Record<string, unknown>[],
  field: string | undefined,
  mode: "count" | "sum" | "avg"
) {
  if (mode === "count") return rows.length;
  const sum = rows.reduce((acc, row) => acc + (Number(row[field ?? ""]) || 0), 0);
  if (mode === "sum") return sum;
  return rows.length === 0 ? 0 : Math.round((sum / rows.length) * 10) / 10;
}

type Props = {
  widget: z.infer<typeof kpiWidgetSchema> | z.infer<typeof computedFieldWidgetSchema>;
  filters: Record<string, string>;
};

export function KpiWidget({ widget, filters }: Props) {
  const query = useCatalogQuery(widget.dataBinding, filters);
  // Gradient ids have to be unique per instance or several sparklines on one
  // dashboard all resolve to whichever <defs> rendered last.
  const gradientId = `spark-${useId().replace(/:/g, "")}`;

  const rows = (query.data ?? null) as Record<string, unknown>[] | null;
  const value = rows ? aggregate(rows, widget.config.field, widget.config.aggregate) : null;
  const display =
    value === null ? "—" : widget.config.format === "percent" ? `${value}%` : value.toLocaleString();

  const trendConfig = widget.config.trend;
  // Computed from the same rows the number came from — never authored, and
  // absent whenever the data can't support it.
  const trend =
    rows && trendConfig ? computeTrend(rows, trendConfig.field, trendConfig.goodDirection) : null;

  const DirectionIcon =
    trend?.direction === "down" ? ArrowDownRight : trend?.direction === "up" ? ArrowUpRight : ArrowRight;
  const trendColor = trend?.isGood ? "var(--status-done)" : "var(--destructive)";

  return (
    <Card className="h-full gap-0 py-4">
      <CardContent className="flex h-full flex-col px-4">
        {query.error ? (
          <p className="text-destructive text-sm">{query.error.message}</p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs font-medium">{widget.config.label}</p>
            <div className={trend ? "mt-1.5" : "my-auto py-1.5"}>
              <p
                className="text-[28px] leading-none font-semibold tracking-tight"
                style={
                  widget.config.intent === "danger" ? { color: "var(--destructive)" } : undefined
                }
              >
                {display}
              </p>

              {trend && (
                <p className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  <span
                    className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium"
                    style={{
                      color: trendColor,
                      backgroundColor: `color-mix(in oklch, ${trendColor}, transparent 88%)`,
                    }}
                  >
                    <DirectionIcon className="size-3" />
                    {trend.changePercent === null
                      ? // No usable baseline, so the movement is reported
                        // without a made-up percentage.
                        `${trend.previous} → ${trend.latest}`
                      : `${Math.abs(trend.changePercent)}%`}
                  </span>
                  <span className="text-muted-foreground">vs previous period</span>
                </p>
              )}

              {!trend && widget.config.note && (
                <p className="text-muted-foreground mt-2 text-xs">{widget.config.note}</p>
              )}
            </div>

            {trend && (
              <div className="mt-auto -mb-1 h-9 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area
                      dataKey="y"
                      stroke="var(--chart-1)"
                      strokeWidth={1.5}
                      fill={`url(#${gradientId})`}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
