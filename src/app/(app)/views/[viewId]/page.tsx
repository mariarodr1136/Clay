"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { ViewRenderer } from "@/components/renderer/view-renderer";
import { ViewChatPanel } from "@/components/views/view-chat-panel";
import { VersionHistory } from "@/components/views/version-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ViewPage() {
  const params = useParams<{ viewId: string }>();
  const viewQuery = trpc.views.get.useQuery({ id: params.viewId });
  const utils = trpc.useUtils();

  const refresh = () => {
    utils.views.get.invalidate({ id: params.viewId });
    utils.views.listVersions.invalidate({ viewId: params.viewId });
  };

  const publish = trpc.views.publish.useMutation({
    onSuccess: () => {
      toast.success("Published to organization");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const unpublish = trpc.views.unpublish.useMutation({
    onSuccess: () => {
      toast.success("Unpublished — back to personal");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (viewQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (viewQuery.error || !viewQuery.data) {
    return <p className="text-destructive text-sm">{viewQuery.error?.message ?? "View not found"}</p>;
  }

  const isOrgScope = viewQuery.data.view.scope === "org";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{viewQuery.data.view.name}</h1>
          <Badge variant={isOrgScope ? "default" : "outline"}>{viewQuery.data.view.scope}</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={publish.isPending || unpublish.isPending}
          onClick={() =>
            isOrgScope
              ? unpublish.mutate({ viewId: params.viewId })
              : publish.mutate({ viewId: params.viewId })
          }
        >
          {isOrgScope ? "Unpublish" : "Publish to org"}
        </Button>
      </div>
      <ViewRenderer schema={viewQuery.data.schema} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ViewChatPanel viewId={params.viewId} onUpdated={refresh} />
        <VersionHistory viewId={params.viewId} onReverted={refresh} />
      </div>
    </div>
  );
}
