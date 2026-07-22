import { statusMeta, priorityMeta } from "@/lib/task-display";
import type { taskPriorities, taskStatuses } from "@/server/db/schema";

export function StatusBadge({ status }: { status: (typeof taskStatuses)[number] }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5" style={{ color: `var(${meta.colorVar})` }} />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: (typeof taskPriorities)[number] }) {
  const meta = priorityMeta[priority];
  return (
    <span
      className="inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in oklch, var(${meta.colorVar}), transparent 85%)`,
        color: `var(${meta.colorVar})`,
      }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: `var(${meta.colorVar})` }}
      />
      {meta.label}
    </span>
  );
}
