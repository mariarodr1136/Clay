"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { ViewRenderer } from "@/components/renderer/view-renderer";
import { ViewChatPanel } from "@/components/views/view-chat-panel";
import { VersionHistory } from "@/components/views/version-history";

export default function ViewPage() {
  const params = useParams<{ viewId: string }>();
  const viewQuery = trpc.views.get.useQuery({ id: params.viewId });
  const utils = trpc.useUtils();

  const refresh = () => {
    utils.views.get.invalidate({ id: params.viewId });
    utils.views.listVersions.invalidate({ viewId: params.viewId });
  };

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
      <div className="grid gap-4 sm:grid-cols-2">
        <ViewChatPanel viewId={params.viewId} onUpdated={refresh} />
        <VersionHistory viewId={params.viewId} onReverted={refresh} />
      </div>
    </div>
  );
}
