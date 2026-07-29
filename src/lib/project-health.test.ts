import { describe, expect, it } from "vitest";
import { projectHealth } from "./project-health";

// The badge is derived, so these rules are the whole feature. A project that
// reads "on track" while three things are overdue is worse than no badge.
const today = new Date("2026-06-15T12:00:00Z");
const base = { overdue: 0, total: 10, done: 5, targetDate: null, today };

describe("projectHealth", () => {
  it("is on track with nothing overdue and no deadline pressure", () => {
    expect(projectHealth(base).health).toBe("on_track");
  });

  it("is on track for a brand-new project with no tasks", () => {
    const verdict = projectHealth({ ...base, total: 0, done: 0 });
    expect(verdict.health).toBe("on_track");
    expect(verdict.reason).toBe("No tasks yet");
  });

  it("is at risk with a little overdue work", () => {
    expect(projectHealth({ ...base, overdue: 1 }).health).toBe("at_risk");
    expect(projectHealth({ ...base, overdue: 2 }).health).toBe("at_risk");
  });

  it("is off track once overdue work piles up, deadline or not", () => {
    const verdict = projectHealth({ ...base, overdue: 3 });
    expect(verdict.health).toBe("off_track");
    expect(verdict.reason).toBe("3 overdue tasks");
  });

  it("is off track past its target with work still open", () => {
    const verdict = projectHealth({ ...base, targetDate: "2026-06-01" });
    expect(verdict.health).toBe("off_track");
    expect(verdict.reason).toMatch(/14 days ago/);
  });

  it("is not punished for a passed target once everything is done", () => {
    // Finished late is still finished — the badge shouldn't nag forever.
    const verdict = projectHealth({ ...base, done: 10, targetDate: "2026-06-01" });
    expect(verdict.health).toBe("on_track");
  });

  it("is at risk when the deadline is close and progress is behind", () => {
    const verdict = projectHealth({ ...base, done: 3, targetDate: "2026-06-20" });
    expect(verdict.health).toBe("at_risk");
    expect(verdict.reason).toMatch(/30% done with 5 days to target/);
  });

  it("is on track when the deadline is close but the work is nearly done", () => {
    expect(projectHealth({ ...base, done: 9, targetDate: "2026-06-20" }).health).toBe("on_track");
  });

  it("ignores a distant deadline even when barely started", () => {
    expect(projectHealth({ ...base, done: 1, targetDate: "2026-12-01" }).health).toBe("on_track");
  });

  it("always explains itself", () => {
    for (const overdue of [0, 1, 5]) {
      expect(projectHealth({ ...base, overdue }).reason.length).toBeGreaterThan(0);
    }
  });
});
