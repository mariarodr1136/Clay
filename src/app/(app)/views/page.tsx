"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ViewsPage() {
  const viewsQuery = trpc.views.list.useQuery();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Views</h1>

      {viewsQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {viewsQuery.data && viewsQuery.data.length === 0 && (
        <p className="text-muted-foreground text-sm">No views yet.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {viewsQuery.data?.map((view) => (
          <Link key={view.id} href={`/views/${view.id}`}>
            <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-14px_rgba(0,0,0,0.14)]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {view.name}
                  <Badge variant="outline">{view.scope}</Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
