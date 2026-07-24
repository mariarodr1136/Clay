"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CircleCheck,
  GitBranch,
  History,
  Pencil,
  Send,
  ShieldX,
  Undo2,
  UserRound,
} from "lucide-react";
import {
  auditActionMeta,
  demoAuditLog,
  type DemoAuditAction,
  type DemoAuditEntry,
} from "@/fixtures/demo-dashboards";
import { demoPerson } from "@/fixtures/demo-data";
import { DemoAvatar } from "@/components/demo/demo-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const actionIcons: Record<DemoAuditAction, typeof Pencil> = {
  created: GitBranch,
  refined: Pencil,
  published: Send,
  rolled_back: Undo2,
  rejected: ShieldX,
};

const groupOrder: DemoAuditEntry["group"][] = ["Today", "Yesterday", "Earlier this week", "Older"];

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

function AuditEntry({ entry }: { entry: DemoAuditEntry }) {
  const meta = auditActionMeta[entry.action];
  const Icon = actionIcons[entry.action];
  const person = demoPerson(entry.personId);

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
          <Icon className="size-3.5" />
        </span>
        <span className="bg-border mt-1.5 w-px flex-1" />
      </div>
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold" style={{ color: `var(${meta.colorVar})` }}>
            {meta.label}
          </span>
          {entry.viewId ? (
            <Link
              href={`/demo/views/${entry.viewId}`}
              className="truncate text-sm font-medium hover:underline"
            >
              {entry.viewName}
            </Link>
          ) : (
            <span className="text-muted-foreground truncate text-sm">{entry.viewName}</span>
          )}
          {entry.version != null && (
            <span className="text-muted-foreground text-xs">v{entry.version}</span>
          )}
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">{entry.timeLabel}</span>
        </div>

        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
          {entry.actorType === "agent" ? (
            <>
              <Bot className="size-3.5" />
              Agent, on behalf of
            </>
          ) : (
            <UserRound className="size-3.5" />
          )}
          <DemoAvatar person={person} className="size-4 text-[8px]" />
          {person.name}
        </p>

        {entry.prompt && (
          <p className="text-muted-foreground border-border mt-2 border-l-2 pl-3 text-sm italic">
            &ldquo;{entry.prompt}&rdquo;
          </p>
        )}
        {entry.detail && <p className="text-muted-foreground mt-2 text-sm">{entry.detail}</p>}
        {entry.diff && (
          <ul className="mt-2 space-y-1">
            {entry.diff.map((line, i) => (
              <li key={i} className="text-muted-foreground font-mono text-xs">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function DemoAuditPage() {
  const [actionFilter, setActionFilter] = useState<DemoAuditAction | null>(null);

  const entries = useMemo(
    () => (actionFilter ? demoAuditLog.filter((e) => e.action === actionFilter) : demoAuditLog),
    [actionFilter]
  );

  const agentActions = demoAuditLog.filter((e) => e.actorType === "agent").length;
  const viewsTouched = new Set(demoAuditLog.filter((e) => e.viewId).map((e) => e.viewId)).size;
  const blocked = demoAuditLog.filter((e) => e.action === "rejected").length;

  return (
    <>
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
          <span className="bg-accent flex size-9 items-center justify-center rounded-full">
            <History className="text-accent-foreground size-4.5" />
          </span>
          Audit log
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Every view created, refined, published, or rolled back — who did it, the exact prompt that
          caused it, and what changed. Agent actions are attributed to the member they acted for,
          and blocked proposals are recorded too.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Events" value={String(demoAuditLog.length)} sub="last 14 days" />
        <StatTile label="Views touched" value={String(viewsTouched)} sub="created or changed" />
        <StatTile
          label="Agent actions"
          value={String(agentActions)}
          sub="every one traceable to a prompt"
        />
        <StatTile label="Blocked proposals" value={String(blocked)} sub="stopped by validation" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActionFilter(null)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            actionFilter === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          All · {demoAuditLog.length}
        </button>
        {(Object.keys(auditActionMeta) as DemoAuditAction[]).map((action) => {
          const count = demoAuditLog.filter((e) => e.action === action).length;
          const active = actionFilter === action;
          return (
            <button
              key={action}
              onClick={() => setActionFilter(active ? null : action)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {auditActionMeta[action].label} · {count}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {groupOrder.map((group) => {
          const groupEntries = entries.filter((e) => e.group === group);
          if (groupEntries.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {group}
              </h2>
              <Card className="py-5">
                <CardContent>
                  {groupEntries.map((entry) => (
                    <AuditEntry key={entry.id} entry={entry} />
                  ))}
                </CardContent>
              </Card>
            </section>
          );
        })}
        {entries.length === 0 && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CircleCheck className="size-4" />
            No events match this filter.
          </p>
        )}
      </div>
    </>
  );
}
