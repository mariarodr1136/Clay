"use client";

import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { parseView } from "@/lib/dsl/validate";
import { diffViews, type ViewDiffLine } from "@/lib/view-diff";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const diffGlyph: Record<ViewDiffLine["op"], { char: string; colorVar: string }> = {
  add: { char: "+", colorVar: "--status-done" },
  change: { char: "±", colorVar: "--status-in-progress" },
  remove: { char: "−", colorVar: "--priority-urgent" },
};

function DiffLines({ lines }: { lines: ViewDiffLine[] }) {
  if (lines.length === 0) return null;
  const shown = lines.slice(0, 5);
  return (
    <ul className="mt-1 space-y-0.5">
      {shown.map((line, i) => (
        <li key={i} className="flex gap-2 text-xs">
          <span
            className="w-3 shrink-0 text-center font-mono font-bold"
            style={{ color: `var(${diffGlyph[line.op].colorVar})` }}
          >
            {diffGlyph[line.op].char}
          </span>
          <span className="text-muted-foreground">{line.text}</span>
        </li>
      ))}
      {lines.length > shown.length && (
        <li className="text-muted-foreground/70 pl-5 text-xs">
          +{lines.length - shown.length} more change{lines.length - shown.length === 1 ? "" : "s"}
        </li>
      )}
    </ul>
  );
}

export function VersionHistory({ viewId, onReverted }: { viewId: string; onReverted: () => void }) {
  const versionsQuery = trpc.views.listVersions.useQuery({ viewId });

  const revert = trpc.views.revert.useMutation({
    onSuccess: () => {
      toast.success("Reverted");
      versionsQuery.refetch();
      onReverted();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!versionsQuery.data || versionsQuery.data.length <= 1) return null;

  // What each version changed, computed against its parent — the same
  // structural summary for agent edits, manual layout edits, and reverts.
  const byId = new Map(versionsQuery.data.map((v) => [v.id, v]));
  const diffFor = (versionId: string): ViewDiffLine[] => {
    const version = byId.get(versionId);
    const parent = version?.parentVersionId ? byId.get(version.parentVersionId) : undefined;
    if (!version || !parent) return [];
    const older = parseView(parent.schemaJson);
    const newer = parseView(version.schemaJson);
    if (!older.success || !newer.success) return [];
    return diffViews(older.data, newer.data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="text-muted-foreground size-4" />
          History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {versionsQuery.data.map((version, i) => (
          <div key={version.id} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={i === 0 ? "border-transparent bg-accent text-accent-foreground" : ""}
                >
                  {version.createdBy}
                </Badge>
                <span
                  className="text-muted-foreground truncate"
                  title={new Date(version.createdAt).toLocaleString()}
                >
                  {version.promptText ?? "Created"} ·{" "}
                  {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                </span>
              </div>
              {i !== 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revert.isPending}
                  onClick={() => revert.mutate({ viewId, versionId: version.id })}
                >
                  Revert to this
                </Button>
              )}
            </div>
            <DiffLines lines={diffFor(version.id)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
