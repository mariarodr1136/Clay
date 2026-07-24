"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CalendarClock, Plus } from "lucide-react";
import {
  demoPerson,
  demoProjectById,
  demoTasksForProject,
  isOverdue,
  projectStats,
  todayIso,
  type DemoTask,
} from "@/fixtures/demo-data";
import { statusMeta } from "@/lib/task-display";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { DemoActionButton } from "@/components/demo/demo-action-button";
import { DemoAvatar } from "@/components/demo/demo-avatar";
import { DemoHealthChip } from "@/components/demo/demo-health-chip";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusOrder = ["todo", "in_progress", "in_review", "done"] as const;

function DueCell({ task }: { task: DemoTask }) {
  const overdue = isOverdue(task);
  const days = overdue
    ? Math.max(1, Math.round((Date.parse(todayIso()) - Date.parse(task.dueDate)) / 86_400_000))
    : 0;
  return (
    <span className={overdue ? "text-destructive text-sm font-medium" : "text-muted-foreground text-sm"}>
      {format(parseISO(task.dueDate), "MMM d")}
      {overdue && ` · ${days}d over`}
    </span>
  );
}

export default function DemoProjectPage() {
  const params = useParams<{ id: string }>();
  const project = demoProjectById(params.id);
  const [statusFilter, setStatusFilter] = useState<DemoTask["status"] | null>(null);

  if (!project) {
    return (
      <p className="text-muted-foreground text-sm">
        Project not found.{" "}
        <Link href="/demo" className="text-foreground font-medium hover:underline">
          Back to projects
        </Link>
      </p>
    );
  }

  const tasks = demoTasksForProject(project.id);
  const stats = projectStats(project.id);
  const lead = demoPerson(project.leadId);
  const visibleTasks = statusFilter ? tasks.filter((t) => t.status === statusFilter) : tasks;

  return (
    <>
      <div className="space-y-4">
        <Link
          href="/demo"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft className="size-3.5" />
          Projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span
              className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white"
              style={{ backgroundColor: `var(${project.colorVar})` }}
            >
              {project.shortName.charAt(0)}
            </span>
            <div className="space-y-1">
              <h1 className="flex flex-wrap items-center gap-2.5 text-3xl font-semibold tracking-tight">
                {project.name}
                <DemoHealthChip health={project.health} />
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                {project.description}
              </p>
            </div>
          </div>
          <DemoActionButton message="Sign up to create tasks.">
            <Plus data-icon="inline-start" />
            New task
          </DemoActionButton>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <DemoAvatar person={lead} />
            Led by <span className="text-foreground font-medium">{lead.name}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {project.memberIds.map((id) => (
                <DemoAvatar key={id} person={demoPerson(id)} className="ring-background ring-2" />
              ))}
            </span>
            {project.memberIds.length} members
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-4" />
            Target {format(parseISO(project.targetDate), "MMM d")}
          </span>
          <span>
            <span className="text-foreground font-medium tabular-nums">{stats.openPoints}</span> pts
            open
          </span>
          {stats.overdue > 0 && (
            <span className="text-destructive font-medium">{stats.overdue} overdue</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            statusFilter === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          All · {tasks.length}
        </button>
        {statusOrder.map((status) => {
          const count = tasks.filter((t) => t.status === status).length;
          const active = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(active ? null : status)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {statusMeta[status].label} · {count}
            </button>
          );
        })}
        <span className="text-muted-foreground ml-auto hidden text-xs sm:block">
          {stats.percentDone}% complete
        </span>
      </div>

      <div className="bg-card ring-black/[0.04] overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)] ring-1 dark:ring-white/[0.06]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Pts</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTasks.map((task) => {
              const assignee = demoPerson(task.assigneeId);
              return (
                <TableRow key={task.id}>
                  <TableCell className="max-w-xs">
                    <p className="truncate font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {task.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <DemoAvatar person={assignee} />
                      {assignee.name.split(" ")[0]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-muted rounded-full px-2 py-0.5 text-[11px] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                    {task.points}
                  </TableCell>
                  <TableCell>
                    <DueCell task={task} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
