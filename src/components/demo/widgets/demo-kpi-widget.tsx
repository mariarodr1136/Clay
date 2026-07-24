"use client";

import { useId } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { DemoWidget } from "@/fixtures/demo-dashboards";
import { runDemoQuery } from "@/fixtures/demo-data";
import { Card, CardContent } from "@/components/ui/card";

type KpiWidget = Extract<DemoWidget, { type: "kpi" }>;

function formatValue(value: string | number, format: KpiWidget["config"]["format"]) {
  if (typeof value === "string") return value;
  const n = value.toLocaleString();
  if (format === "percent") return `${n}%`;
  if (format === "points") return `${n} pts`;
  if (format === "days") return `${n} days`;
  return n;
}

export function DemoKpiWidget({
  widget,
  filters,
}: {
  widget: KpiWidget;
  filters: Record<string, string>;
}) {
  const cfg = widget.config;
  const sparkGradient = useId().replace(/:/g, "");

  let value: string | number = cfg.value ?? "—";
  if (cfg.value === undefined && widget.query) {
    const rows = runDemoQuery(widget.query.queryId, widget.query.params ?? {}, filters);
    value =
      cfg.aggregate === "sum"
        ? rows.reduce((sum, row) => sum + (Number(row[cfg.field ?? ""]) || 0), 0)
        : rows.length;
  }

  const delta = cfg.delta;
  const DeltaIcon = delta?.direction === "down" ? ArrowDownRight : ArrowUpRight;
  const deltaColor = delta?.positive ? "var(--status-done)" : "var(--destructive)";

  return (
    <Card className="h-full gap-0 py-4">
      <CardContent className="flex h-full flex-col px-4">
        <p className="text-muted-foreground text-xs font-medium">{cfg.label}</p>
        <div className={cfg.spark ? "mt-1.5" : "my-auto py-1.5"}>
          <p
            className="text-[28px] leading-none font-semibold tracking-tight"
            style={cfg.intent === "danger" ? { color: "var(--destructive)" } : undefined}
          >
            {formatValue(value, cfg.format)}
          </p>
          {delta && (
            <p className="mt-2 flex items-center gap-1 text-xs">
              <span
                className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium"
                style={{
                  color: deltaColor,
                  backgroundColor: `color-mix(in oklch, ${deltaColor}, transparent 88%)`,
                }}
              >
                <DeltaIcon className="size-3" />
                {delta.value}
              </span>
              <span className="text-muted-foreground">{delta.caption}</span>
            </p>
          )}
          {!delta && cfg.note && <p className="text-muted-foreground mt-2 text-xs">{cfg.note}</p>}
        </div>
        {cfg.spark && (
          <div className="mt-auto -mb-1 h-9 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cfg.spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={sparkGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="y"
                  stroke="var(--chart-1)"
                  strokeWidth={1.5}
                  fill={`url(#${sparkGradient})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
