"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  Bot,
  EyeOff,
  GitBranch,
  History,
  ListChecks,
  Pencil,
  Send,
  ShieldAlert,
  Undo2,
  UserRound,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuditKind = "created" | "refined" | "reverted" | "published" | "unpublished" | "blocked";

type ActivityEntry = {
  id: string;
  viewId: string;
  viewName: string;
  kind: string;
  createdBy: "agent" | "user" | null;
  actorName: string | null;
  promptText: string | null;
  detail: string | null;
  createdAt: string | Date;
};

// One row per kind of thing that can happen to a view. Colours come from the
// same status tokens the rest of the app uses, so "published" reads as
// finished and "blocked" reads as a stop.
const KIND_META: Record<AuditKind, { label: string; colorVar: string; icon: typeof GitBranch }> = {
  created: { label: "Created", colorVar: "--status-in-progress", icon: GitBranch },
  refined: { label: "Refined", colorVar: "--status-in-review", icon: Pencil },
  reverted: { label: "Rolled back", colorVar: "--status-todo", icon: Undo2 },
  published: { label: "Published", colorVar: "--status-done", icon: Send },
  unpublished: { label: "Unpublished", colorVar: "--status-todo", icon: EyeOff },
  blocked: { label: "Blocked", colorVar: "--destructive", icon: ShieldAlert },
};

const KIND_ORDER: AuditKind[] = [
  "created",
  "refined",
  "published",
  "reverted",
  "unpublished",
  "blocked",
];

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
  const meta = KIND_META[(entry.kind as AuditKind) ?? "created"] ?? KIND_META.created;
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
              {entry.kind === "blocked"
                ? "Agent proposal, stopped by validation"
                : "Agent, from a prompt"}
            </>
          ) : (
            <>
              <UserRound className="size-3.5" />
              {entry.actorName ?? "Manual edit"}
            </>
          )}
        </p>

        {entry.promptText && (
          <p className="text-muted-foreground border-border mt-2 border-l-2 pl-3 text-sm italic">
            &ldquo;{entry.promptText}&rdquo;
          </p>
        )}

        {entry.detail && (
          <p className="text-destructive/90 mt-2 border-l-2 border-destructive/40 pl-3 text-xs">
            {entry.detail}
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
  const [kindFilter, setKindFilter] = useState<AuditKind | null>(null);
  const [tab, setTab] = useState<"views" | "work">("views");

  const all = (activityQuery.data ?? []) as ActivityEntry[];
  const entries = kindFilter ? all.filter((e) => e.kind === kindFilter) : all;
  const countOf = (kind: AuditKind) => all.filter((e) => e.kind === kind).length;

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Events" value={String(all.length)} sub="most recent 100" />
            <StatTile label="Views touched" value={String(viewsTouched)} sub="created or changed" />
            <StatTile
              label="Agent actions"
              value={String(agentActions)}
              sub="every one traceable to a prompt"
            />
            <StatTile
              label="Blocked proposals"
              value={String(countOf("blocked"))}
              sub="stopped by validation"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setKindFilter(null)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                kindFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              All · {all.length}
            </button>
            {/* Only kinds that actually occurred — an empty "Blocked · 0"
                chip is noise, and its absence is itself information. */}
            {KIND_ORDER.filter((kind) => countOf(kind) > 0).map((kind) => (
              <button
                key={kind}
                onClick={() => setKindFilter(kind)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  kindFilter === kind
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {KIND_META[kind].label} · {countOf(kind)}
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
