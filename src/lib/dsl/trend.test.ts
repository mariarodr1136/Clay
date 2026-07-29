import { describe, expect, it } from "vitest";
import { computeTrend } from "./trend";

// An arrow pointing the wrong way is worse than no arrow, so the direction
// and the "is this good" judgement get their own cases.
const weeks = (...values: number[]) =>
  values.map((points, i) => ({ week: `2026-W0${i + 1}`, points }));

describe("computeTrend", () => {
  it("plots every row and compares the last two periods", () => {
    const trend = computeTrend(weeks(10, 12, 18), "points");
    expect(trend?.points.map((p) => p.y)).toEqual([10, 12, 18]);
    expect(trend?.previous).toBe(12);
    expect(trend?.latest).toBe(18);
    expect(trend?.changePercent).toBe(50);
    expect(trend?.direction).toBe("up");
  });

  it("labels points from the row's own period column", () => {
    const trend = computeTrend(weeks(4, 6), "points");
    expect(trend?.points.map((p) => p.x)).toEqual(["2026-W01", "2026-W02"]);
  });

  it("judges good and bad by the metric, not by the direction", () => {
    // Velocity climbing is good news.
    expect(computeTrend(weeks(10, 20), "points", "up")?.isGood).toBe(true);
    // Cycle time climbing is not.
    expect(computeTrend(weeks(10, 20), "points", "down")?.isGood).toBe(false);
    // And falling cycle time is.
    expect(computeTrend(weeks(20, 10), "points", "down")?.isGood).toBe(true);
  });

  it("returns nothing when there is only one period", () => {
    // A single reading isn't a trend, and a flat line would imply stability
    // that hasn't been measured.
    expect(computeTrend(weeks(10), "points")).toBeNull();
    expect(computeTrend([], "points")).toBeNull();
  });

  it("refuses to compute a percentage from a zero baseline", () => {
    // "Up 100%" from nothing is arithmetic, not information — the widget
    // shows the raw values instead.
    const trend = computeTrend(weeks(0, 7), "points");
    expect(trend?.changePercent).toBeNull();
    expect(trend?.direction).toBe("up");
    expect([trend?.previous, trend?.latest]).toEqual([0, 7]);
  });

  it("reports no movement as flat, and treats it as fine", () => {
    const trend = computeTrend(weeks(9, 9), "points");
    expect(trend?.direction).toBe("flat");
    expect(trend?.changePercent).toBe(0);
    expect(trend?.isGood).toBe(true);
  });

  it("skips rows whose value isn't a number", () => {
    const rows = [
      { week: "a", points: 5 },
      { week: "b", points: null },
      { week: "c", points: "8" },
    ];
    const trend = computeTrend(rows, "points");
    // The null row drops out; the numeric string is still a number.
    expect(trend?.points.map((p) => p.y)).toEqual([5, 8]);
  });

  it("handles a decrease to a negative-free percentage", () => {
    const trend = computeTrend(weeks(20, 15), "points");
    expect(trend?.direction).toBe("down");
    expect(trend?.changePercent).toBe(-25);
  });
});
