// Whether a project is in trouble, derived rather than typed in.
//
// A status someone sets by hand goes stale the day after they set it, and
// the honest signals are already in the data: how much is overdue, how close
// the target date is, and how much is actually finished. Nobody has to
// remember to update this, and it can't disagree with the board it sits on.

export type ProjectHealth = "on_track" | "at_risk" | "off_track";

export type HealthInput = {
  overdue: number;
  total: number;
  done: number;
  targetDate: string | null;
  // Injectable so the rules can be tested without waiting for tomorrow.
  today?: Date;
};

export type HealthVerdict = {
  health: ProjectHealth;
  // Why, in the words the badge's tooltip uses. A status with no reason is
  // just a colour.
  reason: string;
};

const DAY_MS = 86_400_000;

// Under a fortnight out is when a deadline starts constraining decisions.
const CLOSE_TO_TARGET_DAYS = 14;
// Below this at that point, the remaining work stops looking routine.
const BEHIND_PERCENT = 70;
// One late task is a normal week, not a project in trouble. Two is a
// pattern. The earlier rule flagged anything with a single overdue item,
// which meant almost everything read as at risk and the badge stopped
// carrying information.
const AT_RISK_OVERDUE = 2;
// And a pile of overdue work only means off track if it's a real share of
// what's left — three late tasks out of forty is not the same project as
// three out of five.
const OFF_TRACK_OVERDUE = 3;
const OFF_TRACK_OVERDUE_SHARE = 1 / 3;

export function projectHealth(input: HealthInput): HealthVerdict {
  const { overdue, total, done, targetDate } = input;
  const today = input.today ?? new Date();
  const percentComplete = total === 0 ? 0 : Math.round((done / total) * 100);

  const daysToTarget = targetDate
    ? Math.round((Date.parse(`${targetDate}T00:00:00Z`) - startOfDayUtc(today)) / DAY_MS)
    : null;

  // Past its date with work still open is the one unambiguous case.
  if (daysToTarget !== null && daysToTarget < 0 && done < total) {
    return {
      health: "off_track",
      reason: `Target date passed ${Math.abs(daysToTarget)} ${plural(Math.abs(daysToTarget), "day")} ago with ${total - done} still open`,
    };
  }

  // Enough overdue work is its own problem, regardless of the target date —
  // a project with no deadline can still be visibly failing. Judged as a
  // share of what's still open, so a big project isn't condemned by the
  // same absolute count that would sink a small one.
  const open = Math.max(total - done, 0);
  const overdueShare = open === 0 ? 0 : overdue / open;

  if (overdue >= OFF_TRACK_OVERDUE && overdueShare >= OFF_TRACK_OVERDUE_SHARE) {
    return {
      health: "off_track",
      reason: `${overdue} of ${open} open ${plural(open, "task")} overdue`,
    };
  }

  if (overdue >= AT_RISK_OVERDUE) {
    return {
      health: "at_risk",
      reason: `${overdue} overdue ${plural(overdue, "task")}`,
    };
  }

  if (
    daysToTarget !== null &&
    daysToTarget <= CLOSE_TO_TARGET_DAYS &&
    percentComplete < BEHIND_PERCENT
  ) {
    return {
      health: "at_risk",
      reason: `${percentComplete}% done with ${daysToTarget} ${plural(daysToTarget, "day")} to target`,
    };
  }

  return {
    health: "on_track",
    reason:
      total === 0
        ? "No tasks yet"
        : overdue === 0
          ? `${percentComplete}% done, nothing overdue`
          : `${percentComplete}% done, one task running late`,
  };
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function plural(n: number, word: string) {
  return n === 1 ? word : `${word}s`;
}

export const HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

export const HEALTH_COLOR_VARS: Record<ProjectHealth, string> = {
  on_track: "--status-done",
  at_risk: "--status-in-review",
  off_track: "--destructive",
};
