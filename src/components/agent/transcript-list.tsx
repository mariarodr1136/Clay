import Link from "next/link";
import type { TranscriptItem } from "@/lib/use-agent-stream";
import { Badge } from "@/components/ui/badge";
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
            <p key={i} className="text-muted-foreground flex items-center gap-2 text-xs">
              <Badge variant={item.ok ? "outline" : "destructive"}>{item.ok ? "ok" : "error"}</Badge>
              {item.text}
            </p>
          );
        }
        if (item.kind === "view") {
          return (
            <Card key={i}>
              <CardContent className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">{item.name}</span>
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
