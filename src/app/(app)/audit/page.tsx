"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Bot, GitBranch, History, ListChecks, Pencil, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ActivityEntry = {
  id: string;
  viewId: string;
  viewName: string;
  createdBy: "agent" | "user";
  promptText: string | null;
  createdAt: string | Date;
  parentVersionId: string | null;
};

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
      </CardContent>
    </Card>
  );
}

function AuditEntry({ entry }: { entry: ActivityEntry }) {
  const created = !entry.parentVersionId;
  const meta = created
    ? { label: "Created", colorVar: "--status-in-progress", icon: GitBranch }
    : { label: "Refined", colorVar: "--status-in-review", icon: Pencil };
  const when = new Date(entry.createdAt);

  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{
            color: `var(${meta.colorVar})`,
            backgroundColor: `color-mix(in oklch, var(${meta.colorVar}), transparent 88%)`,
          }}
        >
          <meta.icon className="size-3.5" />
        </span>
        <span className="bg-border mt-1.5 w-px flex-1" />
      </div>
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold" style={{ color: `var(${meta.colorVar})` }}>
            {meta.label}
          </span>
          <Link
            href={`/views/${entry.viewId}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {entry.viewName}
          </Link>
          <span
            className="text-muted-foreground ml-auto shrink-0 text-xs"
            title={when.toLocaleString()}
          >
            {formatDistanceToNow(when, { addSuffix: true })}
          </span>
        </div>

        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
          {entry.createdBy === "agent" ? (
            <>
              <Bot className="size-3.5" />
              Agent, from a prompt
            </>
          ) : (
            <>
              <UserRound className="size-3.5" />
              Manual edit
            </>
          )}
        </p>

        {entry.promptText && (
          <p className="text-muted-foreground border-border mt-2 border-l-2 pl-3 text-sm italic">
            &ldquo;{entry.promptText}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

type WorkEntry = {
  id: string;
  verb: string;
  actor: string | null;
  task: string | null;
  taskId: string;
  at: string | Date;
};

const VERB_META: Record<string, { label: string; colorVar: string }> = {
  "task.created": { label: "Created task", colorVar: "--status-todo" },
  "task.status_changed": { label: "Moved task", colorVar: "--status-in-progress" },
  "task.assigned": { label: "Assigned task", colorVar: "--status-in-review" },
  "task.due_date_changed": { label: "Rescheduled task", colorVar: "--status-done" },
};

// The work feed reads through the same allow-listed catalog the agent and
// every widget use (views.runQuery), rather than a bespoke procedure — so
// the audit page is one more consumer of the choke point, not an exception
// to it.
function WorkActivityFeed() {
  const workQuery = trpc.views.runQuery.useQuery({
    queryId: "recentActivity",
    params: { days: 30, limit: 100 },
  });

  const entries = (workQuery.data ?? []) as WorkEntry[];

  if (workQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-3xl border border-dashed py-16 text-center">
        <div className="bg-muted flex size-11 items-center justify-center rounded-full">
          <ListChecks className="text-muted-foreground size-5" />
        </div>
        <p className="text-sm font-medium">No task activity in the last 30 days</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Creating tasks, moving them between columns, and assigning owners all show up here.
        </p>
      </div>
    );
  }

  return (
    <Card className="py-5">
      <CardContent className="space-y-4">
        {entries.map((entry) => {
          const meta = VERB_META[entry.verb] ?? {
            label: entry.verb,
            colorVar: "--status-todo",
          };
          const when = new Date(entry.at);
          return (
            <div key={entry.id} className="flex items-baseline gap-2.5 text-sm">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: `var(${meta.colorVar})` }}
              />
              <span className="font-medium">{entry.actor ?? "Someone"}</span>
              <span className="text-muted-foreground">{meta.label.toLowerCase()}</span>
              <span className="truncate font-medium">{entry.task ?? "a deleted task"}</span>
              <span
                className="text-muted-foreground ml-auto shrink-0 text-xs"
                title={when.toLocaleString()}
              >
                {formatDistanceToNow(when, { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function AuditPage() {
  const activityQuery = trpc.views.listActivity.useQuery({ limit: 100 });
  const [actorFilter, setActorFilter] = useState<"agent" | "user" | null>(null);
  const [tab, setTab] = useState<"views" | "work">("views");

  const all = (activityQuery.data ?? []) as ActivityEntry[];
  const entries = actorFilter ? all.filter((e) => e.createdBy === actorFilter) : all;

  const viewsTouched = new Set(all.map((e) => e.viewId)).size;
  const agentActions = all.filter((e) => e.createdBy === "agent").length;

  const groups: { label: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(new Date(entry.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
          <span className="bg-accent flex size-9 items-center justify-center rounded-full">
            <History className="text-accent-foreground size-4.5" />
          </span>
          Audit log
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Every view created or refined in this organization — who did it and the exact prompt that
          caused it. Agent actions are always traceable to the request behind them.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Audit scope"
        className="bg-muted inline-flex gap-1 rounded-full p-1"
      >
        {(
          [
            ["views", "View changes"],
            ["work", "Task activity"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              tab === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "work" && <WorkActivityFeed />}

      {tab === "views" && activityQuery.isLoading && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {tab === "views" && activityQuery.data && all.length === 0 && (
        <div className="border-border flex flex-col items-center gap-3 rounded-3xl border border-dashed py-16 text-center">
          <div className="bg-muted flex size-11 items-center justify-center rounded-full">
            <History className="text-muted-foreground size-5" />
          </div>
          <p className="text-sm font-medium">No activity yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            As soon as a view is created or changed, the full trail shows up here.
          </p>
        </div>
      )}

      {tab === "views" && all.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Events" value={String(all.length)} sub="most recent 100" />
            <StatTile label="Views touched" value={String(viewsTouched)} sub="created or changed" />
            <StatTile
              label="Agent actions"
              value={String(agentActions)}
              sub="every one traceable to a prompt"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                [null, `All · ${all.length}`],
                ["agent", `Agent · ${agentActions}`],
                ["user", `Manual · ${all.length - agentActions}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                onClick={() => setActorFilter(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  actorFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </h2>
                <Card className="py-5">
                  <CardContent>
                    {group.entries.map((entry) => (
                      <AuditEntry key={entry.id} entry={entry} />
                    ))}
                  </CardContent>
                </Card>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
