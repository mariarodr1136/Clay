"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat("en");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

// Deliberately tokens rather than an estimated dollar figure. Clay is
// bring-your-own-key, so the bill lands on the caller's Anthropic account at
// whatever their rates are — and a per-model price table hardcoded here would
// be wrong the first time pricing moves, in a panel whose whole job is to be
// trusted. Tokens are the thing Clay actually measured.
export function AgentUsagePanel() {
  const [days, setDays] = useState<number>(30);

  const workspace = trpc.members.activeWorkspace.useQuery();
  const isOwner = workspace.data?.role === "owner";

  const stats = trpc.agent.stats.useQuery({ days });
  const mine = trpc.agent.myUsage.useQuery({ days });
  // Gated rather than attempted-and-caught: a member firing this would take a
  // guaranteed 403 on every settings visit.
  const byUser = trpc.agent.usageByUser.useQuery({ days }, { enabled: isOwner });

  const totals = stats.data?.totals;
  const byModel = stats.data?.byModel ?? [];
  const promptTokens =
    (totals?.inputTokens ?? 0) + (totals?.cacheReadTokens ?? 0) + (totals?.cacheWriteTokens ?? 0);
  const cacheHitRate = promptTokens > 0 ? (totals?.cacheReadTokens ?? 0) / promptTokens : 0;
  const succeeded = (totals?.viewsBuilt ?? 0) + (totals?.answered ?? 0);
  const successRate = totals?.runs ? succeeded / totals.runs : 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Agent usage
        </h2>
        <div className="flex items-center gap-1" role="group" aria-label="Time window">
          {WINDOWS.map((option) => (
            <button
              key={option.days}
              type="button"
              aria-pressed={days === option.days}
              onClick={() => setDays(option.days)}
              className={
                days === option.days
                  ? "bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-xs font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6">
          {stats.isPending ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : !totals?.runs ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              No agent runs in this window yet. Ask for a dashboard in Chat and its cost, latency,
              and cache behaviour show up here.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <Stat
                  label="Runs"
                  value={plain.format(totals.runs)}
                  hint={`${plain.format(totals.viewsBuilt)} views, ${plain.format(totals.answered)} answers`}
                />
                <Stat
                  label="Landed"
                  value={`${Math.round(successRate * 100)}%`}
                  hint={totals.failed > 0 ? `${plain.format(totals.failed)} failed` : "none failed"}
                />
                <Stat
                  label="Median latency"
                  value={`${(totals.p50LatencyMs / 1000).toFixed(1)}s`}
                  hint={`p95 ${(totals.p95LatencyMs / 1000).toFixed(1)}s`}
                />
                <Stat
                  label="Prompt cache"
                  value={`${Math.round(cacheHitRate * 100)}%`}
                  hint="of prompt tokens read from cache"
                />
              </div>

              <div className="border-border grid grid-cols-2 gap-5 border-t pt-5 sm:grid-cols-4">
                <Stat label="Input tokens" value={compact.format(totals.inputTokens)} />
                <Stat label="Output tokens" value={compact.format(totals.outputTokens)} />
                <Stat label="Cache reads" value={compact.format(totals.cacheReadTokens)} />
                <Stat
                  label="Yours"
                  value={compact.format(
                    (mine.data?.inputTokens ?? 0) + (mine.data?.outputTokens ?? 0)
                  )}
                  hint={`${plain.format(mine.data?.runs ?? 0)} of your runs`}
                />
              </div>

              {byModel.length > 1 && (
                <div className="border-border space-y-2 border-t pt-5">
                  <p className="text-muted-foreground text-xs font-medium">By model</p>
                  {byModel.map((row) => (
                    <div key={row.model} className="flex items-center justify-between gap-4 text-sm">
                      <span className="truncate font-mono text-xs">{row.model}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {plain.format(row.runs)} runs · {(row.avgLatencyMs / 1000).toFixed(1)}s avg
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isOwner && (byUser.data?.length ?? 0) > 1 && (
                <div className="border-border space-y-2 border-t pt-5">
                  <p className="text-muted-foreground text-xs font-medium">By person</p>
                  {byUser.data?.map((row) => (
                    <div
                      key={row.userId}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {row.name}
                        {row.failed > 0 && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {row.failed} failed
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {plain.format(row.runs)} runs ·{" "}
                        {compact.format(row.inputTokens + row.outputTokens)} tokens ·{" "}
                        {formatDistanceToNow(new Date(row.lastRunAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
