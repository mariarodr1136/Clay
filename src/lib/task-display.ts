import { Circle, CircleDot, CircleCheck, CircleEllipsis } from "lucide-react";
import type { taskPriorities, taskStatuses } from "@/server/db/schema";

export const statusMeta: Record<
  (typeof taskStatuses)[number],
  { label: string; icon: typeof Circle; colorVar: string }
> = {
  todo: { label: "To do", icon: Circle, colorVar: "--status-todo" },
  in_progress: { label: "In progress", icon: CircleDot, colorVar: "--status-in-progress" },
  in_review: { label: "In review", icon: CircleEllipsis, colorVar: "--status-in-review" },
  done: { label: "Done", icon: CircleCheck, colorVar: "--status-done" },
};

export const priorityMeta: Record<
  (typeof taskPriorities)[number],
  { label: string; colorVar: string }
> = {
  low: { label: "Low", colorVar: "--priority-low" },
  medium: { label: "Medium", colorVar: "--priority-medium" },
  high: { label: "High", colorVar: "--priority-high" },
  urgent: { label: "Urgent", colorVar: "--priority-urgent" },
};
