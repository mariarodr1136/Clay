"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bot, ChevronDown, ChevronRight, MessageSquareText, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Past conversations with the view-building agent.
//
// Threads have been persisted since the agent got conversation memory, and
// the transcript procedure has existed just as long — but nothing read
// either, so the work the agent did was only ever visible as the views it
// left behind. This is the record of how they were asked for.
function Transcript({ threadId }: { threadId: string }) {
  const transcript = trpc.agent.transcript.useQuery({ threadId });

  if (transcript.isLoading) {
    return <p className="text-muted-foreground px-4 pb-4 text-sm">Loading…</p>;
  }

  const entries = transcript.data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground px-4 pb-4 text-sm">
        Nothing was said in this conversation.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-4 pb-4">
      {entries.map((entry, index) => (
        <div key={index} className="flex gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
              entry.role === "user" ? "bg-muted" : "bg-accent"
            )}
          >
            {entry.role === "user" ? (
              <UserRound className="text-muted-foreground size-3.5" />
            ) : (
              <Bot className="text-accent-foreground size-3.5" />
            )}
          </span>
          <p
            className={cn(
              "text-sm leading-relaxed",
              entry.role === "user" ? "font-medium" : "text-muted-foreground"
            )}
          >
            {entry.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ConversationHistory() {
  const threads = trpc.agent.listThreads.useQuery({ limit: 20 });
  const [openId, setOpenId] = useState<string | null>(null);

  const items = threads.data ?? [];
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <MessageSquareText className="size-3.5" />
        Past conversations
      </h2>

      <Card className="py-0">
        <CardContent className="divide-border divide-y px-0">
          {items.map((thread) => {
            const isOpen = openId === thread.id;
            return (
              <div key={thread.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : thread.id)}
                  aria-expanded={isOpen}
                  className="hover:bg-muted/50 flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors"
                >
                  {isOpen ? (
                    <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {thread.title}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                  </span>
                </button>

                {isOpen && (
                  <>
                    <Transcript threadId={thread.id} />
                    {thread.viewId && (
                      <p className="px-4 pb-4 text-xs">
                        <Link
                          href={`/views/${thread.viewId}`}
                          className="text-foreground font-medium hover:underline"
                        >
                          Open the view this produced →
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
