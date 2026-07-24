"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Bot, Sparkles, UserRound } from "lucide-react";
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
    return (
      <p className="text-destructive text-sm">
        {viewQuery.error?.message ?? "View not found"}
      </p>
    );
  }

  const isOrgScope = viewQuery.data.view.scope === "org";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-3">
        <Link
          href="/views"
          className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Views
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-semibold tracking-tight">{viewQuery.data.view.name}</h1>
              <Badge variant={isOrgScope ? "default" : "outline"}>
                {viewQuery.data.view.scope}
              </Badge>
            </div>
            {viewQuery.data.version.promptText && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm italic">
                <Sparkles className="size-3.5 shrink-0" />
                &ldquo;{viewQuery.data.version.promptText}&rdquo;
              </p>
            )}
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {viewQuery.data.version.createdBy === "agent" ? (
                <Bot className="size-3.5" />
              ) : (
                <UserRound className="size-3.5" />
              )}
              Current version by {viewQuery.data.version.createdBy} ·{" "}
              {formatDistanceToNow(new Date(viewQuery.data.version.createdAt), {
                addSuffix: true,
              })}
            </p>
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
      </div>
      <ViewRenderer schema={viewQuery.data.schema} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ViewChatPanel viewId={params.viewId} onUpdated={refresh} />
        <VersionHistory viewId={params.viewId} onReverted={refresh} />
      </div>
    </div>
  );
}
