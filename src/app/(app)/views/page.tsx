"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ViewsPage() {
  const viewsQuery = trpc.views.list.useQuery();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Views</h1>
        <p className="text-muted-foreground text-sm">
          Dashboards generated from conversation, saved and versioned.
        </p>
      </div>

      {viewsQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {viewsQuery.data && viewsQuery.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <LayoutDashboard className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No views yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            Ask for one on the Chat page and it&apos;ll show up here.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {viewsQuery.data?.map((view) => (
          <Link key={view.id} href={`/views/${view.id}`}>
            <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-14px_rgba(0,0,0,0.14)]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-accent">
                      <LayoutDashboard className="size-4 text-accent-foreground" />
                    </span>
                    {view.name}
                  </span>
                  <Badge variant={view.scope === "org" ? "default" : "outline"}>{view.scope}</Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
