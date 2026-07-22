"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { ViewRenderer } from "@/components/renderer/view-renderer";

export default function ViewPage() {
  const params = useParams<{ viewId: string }>();
  const viewQuery = trpc.views.get.useQuery({ id: params.viewId });

  if (viewQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (viewQuery.error || !viewQuery.data) {
    return <p className="text-destructive text-sm">{viewQuery.error?.message ?? "View not found"}</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">{viewQuery.data.view.name}</h1>
      <ViewRenderer schema={viewQuery.data.schema} />
    </div>
  );
}
