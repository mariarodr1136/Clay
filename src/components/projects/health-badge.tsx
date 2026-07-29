import { HEALTH_COLOR_VARS, HEALTH_LABELS, type ProjectHealth } from "@/lib/project-health";
import { cn } from "@/lib/utils";

// One badge, rendered wherever a project is shown. The rules already live in
// a single place (project-health.ts); this keeps the colours and the dot from
// drifting apart between the board and the project page the way copied markup
// eventually does.
export function HealthBadge({
  health,
  reason,
  className,
}: {
  health: ProjectHealth;
  // Why the badge says what it says. A status with no explanation is just a
  // colour, so this is required rather than optional.
  reason: string;
  className?: string;
}) {
  const colorVar = HEALTH_COLOR_VARS[health];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className
      )}
      title={reason}
      style={{
        color: `var(${colorVar})`,
        backgroundColor: `color-mix(in oklch, var(${colorVar}), transparent 88%)`,
      }}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {HEALTH_LABELS[health]}
    </span>
  );
}
