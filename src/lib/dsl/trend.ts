// Derives a KPI tile's sparkline and delta from the rows it is already
// bound to.
//
// Everything here is computed. The old demo showed trend arrows that were
// typed into a fixture by hand, which made the demo claim something the
// product couldn't do; a tile that says "up 12%" has to have counted.
//
// Pure and dependency-free so it can be unit tested directly, which matters
// more than usual: an arrow pointing the wrong way is worse than no arrow.

export type TrendPoint = { x: string; y: number };

export type ComputedTrend = {
  points: TrendPoint[];
  // Null when there aren't two comparable periods — a brand-new workspace
  // has one week of data, and inventing a baseline for it would be a lie.
  changePercent: number | null;
  direction: "up" | "down" | "flat";
  // Whether this movement is the good one, per the widget's goodDirection.
  isGood: boolean;
  // The two values behind the delta, for the caption.
  previous: number | null;
  latest: number | null;
};

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeTrend(
  rows: Record<string, unknown>[],
  field: string,
  goodDirection: "up" | "down" = "up"
): ComputedTrend | null {
  const points: TrendPoint[] = [];

  for (const row of rows) {
    const y = numeric(row[field]);
    if (y === null) continue;
    // The first string-ish column doubles as the label. Catalog series put
    // their period first (week, day), so this is that column without the
    // widget having to name it.
    const labelKey = Object.keys(row).find((key) => key !== field && typeof row[key] === "string");
    points.push({ x: labelKey ? String(row[labelKey]) : String(points.length), y });
  }

  // One point is not a line. Rendering a flat sparkline for it would suggest
  // a stable measure rather than a single reading.
  if (points.length < 2) return null;

  const latest = points[points.length - 1].y;
  const previous = points[points.length - 2].y;

  const direction: ComputedTrend["direction"] =
    latest === previous ? "flat" : latest > previous ? "up" : "down";

  // A change from zero has no meaningful percentage — "up 100%" from a base
  // of nothing is arithmetic, not information.
  const changePercent =
    previous === 0 ? null : Math.round(((latest - previous) / Math.abs(previous)) * 100);

  return {
    points,
    changePercent,
    direction,
    isGood: direction === "flat" ? true : direction === goodDirection,
    previous,
    latest,
  };
}
