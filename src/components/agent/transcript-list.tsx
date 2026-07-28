import Link from "next/link";
import { CheckCircle2, LayoutDashboard, XCircle } from "lucide-react";
import type { TranscriptItem } from "@/lib/use-agent-stream";
import { followUpSuggestions } from "@/lib/follow-up-suggestions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TranscriptList({
  items,
  // When set, a delivered view is followed by refinement chips; clicking one
  // hands the suggestion back to the surface that owns the message box.
  onSuggest,
}: {
  items: TranscriptItem[];
  onSuggest?: (suggestion: string) => void;
}) {
  if (items.length === 0) return null;

  const lastViewIndex = items.findLastIndex((item) => item.kind === "view");

  return (
    <div className="space-y-2 border-t pt-4">
      {items.map((item, i) => {
        if (item.kind === "user") {
          return (
            <p key={i} className="text-foreground pt-2 text-sm font-medium first:pt-0">
              {item.text}
            </p>
          );
        }
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
            <div key={i} className="space-y-2">
              <Card>
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
              {onSuggest && i === lastViewIndex && (
                <div className="flex flex-wrap gap-1.5">
                  {followUpSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onSuggest(suggestion)}
                      className="border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
