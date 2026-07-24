"use client";

import { useId } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Presentation-only chart building blocks shared by the live ViewRenderer
// widgets and the /demo fixtures renderer — both feed rows in; neither owns
// the chart look. Mark specs follow the dataviz method: thin bars with
// rounded data-ends, 2px lines, surface gaps between stacked fills, hairline
// grid, legend whenever there are two or more series.

export type ChartSeriesDef = {
  key: string;
  label: string;
  colorVar?: string;
  dashed?: boolean;
};

export type CartesianVariant = "bar" | "stackedBar" | "line" | "area" | "stackedArea";

const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };

// Status keys show up as x-axis categories in status breakdowns.
const prettyLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const pretty = (v: unknown) => prettyLabels[String(v)] ?? String(v);

export function seriesColor(s: ChartSeriesDef) {
  return `var(${s.colorVar ?? "--chart-1"})`;
}

function SeriesKey({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="14" height="6" aria-hidden className="shrink-0">
      <line
        x1="1"
        y1="3"
        x2="13"
        y2="3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={dashed ? "3 3.5" : undefined}
      />
    </svg>
  );
}

// Identity never rides on color alone: any chart with ≥2 series carries this
// legend; a single series is named by the card title instead.
export function ChartLegend({ series }: { series: ChartSeriesDef[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <SeriesKey color={seriesColor(s)} dashed={s.dashed} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

type TipPayload = { dataKey?: string | number; value?: number | string }[];

function ChartTip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: TipPayload;
  label?: string | number;
  series: ChartSeriesDef[];
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(payload.map((p) => [String(p.dataKey), p.value]));
  return (
    <div className="bg-popover text-popover-foreground ring-black/[0.06] dark:ring-white/[0.1] rounded-lg px-3 py-2 text-xs shadow-lg ring-1">
      <p className="text-muted-foreground mb-1 font-medium">{pretty(label)}</p>
      <div className="space-y-0.5">
        {series
          .filter((s) => byKey.has(s.key))
          .map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <SeriesKey color={seriesColor(s)} dashed={s.dashed} />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums">{String(byKey.get(s.key))}</span>
            </p>
          ))}
      </div>
    </div>
  );
}

export function CartesianChartCore({
  variant,
  xField,
  series,
  rows,
}: {
  variant: CartesianVariant;
  xField: string;
  series: ChartSeriesDef[];
  rows: Record<string, unknown>[];
}) {
  const gradientBase = useId().replace(/:/g, "");
  const lastStackedIndex = series.length - 1;
  const singleSeriesBar = variant === "bar" && series.length === 1 && rows.length <= 8;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`${gradientBase}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor(s)} stopOpacity={0.22} />
              <stop offset="100%" stopColor={seriesColor(s)} stopOpacity={0.03} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey={xField}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={axisTick}
          tickFormatter={pretty}
          tickMargin={6}
        />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} width={40} />
        <Tooltip
          content={<ChartTip series={series} />}
          cursor={
            variant === "bar" || variant === "stackedBar"
              ? { fill: "var(--muted)", opacity: 0.55 }
              : { stroke: "var(--border)", strokeWidth: 1 }
          }
        />
        {series.map((s, i) => {
          const color = seriesColor(s);
          if (variant === "bar") {
            return (
              <Bar key={s.key} dataKey={s.key} fill={color} radius={[4, 4, 0, 0]} maxBarSize={22}>
                {singleSeriesBar && (
                  <LabelList
                    dataKey={s.key}
                    position="top"
                    style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                )}
              </Bar>
            );
          }
          if (variant === "stackedBar") {
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="stack"
                fill={color}
                stroke="var(--card)"
                strokeWidth={1}
                maxBarSize={22}
                radius={i === lastStackedIndex ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            );
          }
          if (variant === "stackedArea") {
            return (
              <Area
                key={s.key}
                dataKey={s.key}
                stackId="stack"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientBase}-${i})`}
                activeDot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
              />
            );
          }
          // "line" and "area": dashed series always render as reference lines.
          if (variant === "area" && !s.dashed) {
            return (
              <Area
                key={s.key}
                dataKey={s.key}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientBase}-${i})`}
                activeDot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
              />
            );
          }
          return (
            <Line
              key={s.key}
              dataKey={s.key}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "6 5" : undefined}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const donutSlots = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

export function DonutChartCore({
  rows,
  nameField,
  valueField,
  centerLabel,
  maxSlices = donutSlots.length,
}: {
  rows: Record<string, unknown>[];
  nameField: string;
  valueField: string;
  centerLabel?: string;
  maxSlices?: number;
}) {
  const sorted = [...rows].sort((a, b) => Number(b[valueField]) - Number(a[valueField]));
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const slices = top.map((row, i) => ({
    name: pretty(row[nameField]),
    value: Number(row[valueField]),
    color: `var(${donutSlots[i]})`,
  }));
  if (rest.length > 0) {
    slices.push({
      name: "Other",
      value: rest.reduce((sum, row) => sum + Number(row[valueField]), 0),
      color: "var(--muted-foreground)",
    });
  }
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="flex h-full items-center gap-5">
      <div className="relative h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={1.5}
              stroke="var(--card)"
              strokeWidth={2}
              cornerRadius={3}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                return (
                  <div className="bg-popover text-popover-foreground ring-black/[0.06] dark:ring-white/[0.1] rounded-lg px-3 py-2 text-xs shadow-lg ring-1">
                    <span className="font-medium">{String(p.name)}</span>{" "}
                    <span className="font-semibold tabular-nums">{String(p.value)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {total > 0 ? Math.round((Number(p.value) / total) * 100) : 0}%
                    </span>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{total.toLocaleString()}</span>
          {centerLabel && <span className="text-muted-foreground text-[11px]">{centerLabel}</span>}
        </div>
      </div>
      <ul className="shrink-0 space-y-1.5 pr-1">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-xs">
            <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
