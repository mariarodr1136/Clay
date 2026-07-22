import Link from "next/link";
import { CheckCircle2, LayoutDashboard, XCircle } from "lucide-react";
import type { TranscriptItem } from "@/lib/use-agent-stream";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TranscriptList({ items }: { items: TranscriptItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      {items.map((item, i) => {
        if (item.kind === "text") {
          return (
            <p key={i} className="text-sm">
              {item.text}
            </p>
          );
        }
        if (item.kind === "status") {
          return (
            <p key={i} className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {item.ok ? (
                <CheckCircle2 className="size-3.5 text-(--status-done)" />
              ) : (
                <XCircle className="text-destructive size-3.5" />
              )}
              {item.text}
            </p>
          );
        }
        if (item.kind === "view") {
          return (
            <Card key={i}>
              <CardContent className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <LayoutDashboard className="text-muted-foreground size-4" />
                  {item.name}
                </span>
                <Button asChild size="sm">
                  <Link href={`/views/${item.viewId}`}>View result</Link>
                </Button>
              </CardContent>
            </Card>
          );
        }
        return (
          <p key={i} className="text-destructive text-sm">
            {item.text}
          </p>
        );
      })}
    </div>
  );
}
