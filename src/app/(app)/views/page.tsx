"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ViewsPage() {
  const viewsQuery = trpc.views.list.useQuery();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Views</h1>

      {viewsQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {viewsQuery.data && viewsQuery.data.length === 0 && (
        <p className="text-muted-foreground text-sm">No views yet.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {viewsQuery.data?.map((view) => (
          <Link key={view.id} href={`/views/${view.id}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
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
