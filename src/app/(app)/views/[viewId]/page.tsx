"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, BookmarkPlus, Bot, LayoutTemplate, Sparkles, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { ViewRenderer } from "@/components/renderer/view-renderer";
import { ViewChatPanel } from "@/components/views/view-chat-panel";
import { ViewLayoutEditor } from "@/components/views/view-layout-editor";
import { VersionHistory } from "@/components/views/version-history";
import { ShareDialog } from "@/components/views/share-dialog";
import { ExportMenu, type ExportableTable } from "@/components/views/export-menu";
import { PrintTimestamp } from "@/components/views/print-timestamp";
import { parseView } from "@/lib/dsl/validate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Only tables get a per-widget CSV: a chart or KPI's underlying rows are
// already a sheet in the workbook, and offering them individually would turn
// a short menu into a long one.
function exportableTables(schema: unknown): ExportableTable[] {
  const parsed = parseView(schema);
  if (!parsed.success) return [];
  return parsed.data.widgets
    .filter((w) => w.type === "table")
    .map((w) => ({ id: w.id, title: w.title ?? w.id }));
}

export default function ViewPage() {
  const params = useParams<{ viewId: string }>();
  const viewQuery = trpc.views.get.useQuery({ id: params.viewId });
  const utils = trpc.useUtils();
  // Mirrors the renderer's filter bar so exports (and the printed header) can
  // say what the numbers on screen are actually filtered to.
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editingLayout, setEditingLayout] = useState(false);

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

  const saveTemplate = trpc.views.saveAsTemplate.useMutation({
    onSuccess: (template) => toast.success(`Saved template "${template.name}"`),
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
          <div className="print-hidden flex items-center gap-2">
            <Button
              size="sm"
              variant={editingLayout ? "default" : "outline"}
              onClick={() => setEditingLayout((v) => !v)}
            >
              <LayoutTemplate className="size-3.5" />
              {editingLayout ? "Editing layout" : "Edit layout"}
            </Button>
            <ExportMenu
              exportPath={`/api/views/${params.viewId}/export`}
              tables={exportableTables(viewQuery.data.schema)}
              filters={filters}
            />
            <ShareDialog
              viewId={params.viewId}
              shareToken={viewQuery.data.view.shareToken}
              onChanged={refresh}
            />
            <Button
              size="sm"
              variant="outline"
              title="Save this view as a reusable template"
              disabled={saveTemplate.isPending}
              onClick={() => saveTemplate.mutate({ viewId: params.viewId })}
            >
              <BookmarkPlus className="size-3.5" />
              <span className="hidden sm:inline">Save as template</span>
            </Button>
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
      </div>
      {/* Provenance the screen already shows in the header — repeated here so
          a printed or PDF'd copy carries it too. */}
      <p className="print-only text-muted-foreground text-xs">
        Exported from Clay · <PrintTimestamp filters={filters} />
      </p>
      {editingLayout ? (
        <ViewLayoutEditor
          viewId={params.viewId}
          schema={viewQuery.data.schema}
          onDone={() => {
            setEditingLayout(false);
            refresh();
          }}
        />
      ) : (
        <ViewRenderer schema={viewQuery.data.schema} onFiltersChange={setFilters} />
      )}
      <div className="print-hidden grid gap-4 sm:grid-cols-2">
        <ViewChatPanel viewId={params.viewId} onUpdated={refresh} />
        <VersionHistory viewId={params.viewId} onReverted={refresh} />
      </div>
    </div>
  );
}
