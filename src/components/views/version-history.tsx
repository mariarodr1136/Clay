"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {versionsQuery.data.map((version, i) => (
          <div key={version.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant={i === 0 ? "default" : "outline"}>{version.createdBy}</Badge>
              <span className="text-muted-foreground truncate">
                {version.promptText ?? "Created"} · {new Date(version.createdAt).toLocaleString()}
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
        ))}
      </CardContent>
    </Card>
  );
}
