import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, CalendarClock, Plus } from "lucide-react";
import {
  demoPerson,
  demoProjects,
  portfolioStats,
  projectStats,
} from "@/fixtures/demo-data";
import { DemoActionButton } from "@/components/demo/demo-action-button";
import { DemoAvatar } from "@/components/demo/demo-avatar";
import { DemoHealthChip } from "@/components/demo/demo-health-chip";
import { Card, CardContent } from "@/components/ui/card";

function StatTile({
  label,
  value,
  sub,
  subColorVar,
  valueColorVar,
}: {
  label: string;
  value: string;
  sub?: string;
  subColorVar?: string;
  valueColorVar?: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p
          className="mt-1 text-2xl font-semibold tracking-tight"
          style={valueColorVar ? { color: `var(${valueColorVar})` } : undefined}
        >
          {value}
        </p>
        {sub && (
          <p
            className="text-muted-foreground mt-0.5 text-xs"
            style={subColorVar ? { color: `var(${subColorVar})` } : undefined}
          >
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DemoProjectsPage() {
  const stats = portfolioStats();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Six active projects, one live picture of how they&apos;re going.
          </p>
        </div>
        <DemoActionButton message="Sign up to create your own projects.">
          <Plus data-icon="inline-start" />
          New project
        </DemoActionButton>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Active projects"
          value={String(stats.projects)}
          sub={`${stats.atRisk} at risk`}
          subColorVar="--priority-urgent"
        />
        <StatTile label="Open tasks" value={String(stats.open)} sub={`${stats.inFlight} in flight`} />
        <StatTile
          label="Completed last week"
          value={String(stats.completedLastWeek)}
          sub={`+${stats.velocityDelta} vs prior week`}
          subColorVar="--status-done"
        />
        <StatTile
          label="Overdue"
          value={String(stats.overdue)}
          valueColorVar="--destructive"
          sub="across all projects"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {demoProjects.map((project) => {
          const s = projectStats(project.id);
          const lead = demoPerson(project.leadId);
          return (
            <Link key={project.id} href={`/demo/projects/${project.id}`} className="group">
              <Card className="h-full gap-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-14px_rgba(0,0,0,0.14)]">
                <CardContent className="flex h-full flex-col gap-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                      style={{ backgroundColor: `var(${project.colorVar})` }}
                    >
                      {project.shortName.charAt(0)}
                    </span>
                    <DemoHealthChip health={project.health} />
                  </div>

                  <div className="space-y-1">
                    <h2 className="flex items-center gap-1 font-semibold tracking-tight">
                      {project.name}
                      <ArrowUpRight className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </h2>
                    <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  <div className="mt-auto space-y-3">
                    <div>
                      <div className="text-muted-foreground mb-1 flex justify-between text-[11px] font-medium">
                        <span>
                          {s.done}/{s.total} done
                          {s.overdue > 0 && (
                            <span className="text-destructive"> · {s.overdue} overdue</span>
                          )}
                        </span>
                        <span className="tabular-nums">{s.percentDone}%</span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full"
                        style={{
                          backgroundColor: `color-mix(in oklch, var(${project.colorVar}), transparent 88%)`,
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${s.percentDone}%`,
                            backgroundColor: `var(${project.colorVar})`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-1.5">
                        {project.memberIds.slice(0, 4).map((id) => (
                          <DemoAvatar
                            key={id}
                            person={demoPerson(id)}
                            className="ring-card ring-2"
                          />
                        ))}
                        {project.memberIds.length > 4 && (
                          <span className="bg-muted text-muted-foreground ring-card flex size-6 items-center justify-center rounded-full text-[10px] font-medium ring-2">
                            +{project.memberIds.length - 4}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                        <CalendarClock className="size-3" />
                        {format(parseISO(project.targetDate), "MMM d")}
                        <span className="hidden sm:inline">· {lead.name.split(" ")[0]}</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
