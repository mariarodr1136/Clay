"use client";

// Meter fill carries severity; the track is a lighter step of the same color
// so the state reads across the whole bar, not just the filled part.
function meterColor(percent: number) {
  if (percent >= 85) return "var(--status-done)";
  if (percent >= 55) return "var(--chart-1)";
  if (percent >= 40) return "var(--priority-high)";
  return "var(--priority-urgent)";
}

export function MeterList({
  rows,
  nameField,
  valueField,
}: {
  rows: Record<string, unknown>[];
  nameField: string;
  valueField: string;
}) {
  return (
    <div className="space-y-3.5">
      {rows.map((row) => {
        const percent = Math.max(0, Math.min(100, Number(row[valueField])));
        const color = meterColor(percent);
        return (
          <div key={String(row[nameField])}>
            <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
              <span className="truncate">{String(row[nameField])}</span>
              <span className="text-muted-foreground text-xs font-medium tabular-nums">
                {percent}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: `color-mix(in oklch, ${color}, transparent 86%)` }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
