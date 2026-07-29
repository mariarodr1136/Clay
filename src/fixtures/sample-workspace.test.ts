import { describe, expect, it } from "vitest";
import { sampleProjects } from "./sample-workspace";
import { projectHealth, type ProjectHealth } from "@/lib/project-health";

// The sample workspace is the first thing anyone sees, so its shape is a
// product decision, not incidental data. Every project having something
// overdue once made the whole board read "at risk", which tells a visitor
// nothing about what the badge means.
const DAY_MS = 86_400_000;
const today = new Date("2026-07-29T12:00:00Z");

function healthOf(project: (typeof sampleProjects)[number]): ProjectHealth {
  // Mirrors what listWithStats counts: a task is overdue when it has a due
  // date in the past and isn't done.
  const total = project.tasks.length;
  const done = project.tasks.filter((task) => task.status === "done").length;
  const overdue = project.tasks.filter(
    (task) => task.status !== "done" && task.dueInDays !== undefined && task.dueInDays < 0
  ).length;

  const targetDate =
    project.targetInDays === undefined
      ? null
      : new Date(today.getTime() + project.targetInDays * DAY_MS).toISOString().slice(0, 10);

  return projectHealth({ overdue, total, done, targetDate, today }).health;
}

describe("sample workspace health", () => {
  const live = sampleProjects.filter((project) => !project.archived);
  const states = live.map(healthOf);

  it("shows all three health states", () => {
    expect(new Set(states)).toEqual(new Set(["on_track", "at_risk", "off_track"]));
  });

  it("leans healthy", () => {
    // A demo where most things are failing reads as a broken product rather
    // than a working one.
    const onTrack = states.filter((state) => state === "on_track").length;
    expect(onTrack).toBeGreaterThanOrEqual(Math.ceil(live.length / 2));
  });

  it("keeps exactly one project visibly off track", () => {
    // One is enough to show the red state; more looks like a fire drill.
    expect(states.filter((state) => state === "off_track")).toHaveLength(1);
  });
});
