"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bot, MessageSquarePlus, MessageSquareText, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

// Past conversations with the view-building agent, split into a list and a
// transcript so the page can put them in different places: the list lives in
// a sidebar, the transcript opens in the main column beside it.
//
// Threads have been persisted since the agent got conversation memory, and
// the transcript procedure has existed just as long — but nothing read
// either, so the agent's work was only ever visible as the views it left
// behind. This is the record of how they were asked for.

export function ConversationSidebar({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (threadId: string | null) => void;
}) {
  const threads = trpc.agent.listThreads.useQuery({ limit: 30 });
  const items = threads.data ?? [];

  return (
    <nav aria-label="Past conversations" className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
          selectedId === null
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <MessageSquarePlus className="size-4 shrink-0" />
        New conversation
      </button>

      {items.length > 0 && (
        <p className="text-muted-foreground px-2.5 pt-4 pb-1 text-[11px] font-semibold tracking-wide uppercase">
          Past conversations
        </p>
      )}

      {items.map((thread) => (
        <button
          key={thread.id}
          type="button"
          onClick={() => onSelect(thread.id)}
          aria-current={selectedId === thread.id ? "true" : undefined}
          className={cn(
            "w-full rounded-lg px-2.5 py-2 text-left transition-colors",
            selectedId === thread.id
              ? "bg-accent text-accent-foreground"
              : "hover:bg-muted text-foreground/90"
          )}
        >
          {/* Two lines, clamped: a thread's title is the whole first
              message, which is routinely a paragraph. */}
          <span className="line-clamp-2 text-sm leading-snug">{thread.title}</span>
          <span className="text-muted-foreground mt-0.5 block text-[11px]">
            {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
          </span>
        </button>
      ))}

      {threads.data && items.length === 0 && (
        <p className="text-muted-foreground px-2.5 py-2 text-xs leading-relaxed">
          Conversations you have with the agent will collect here.
        </p>
      )}
    </nav>
  );
}

export function ConversationTranscript({ threadId }: { threadId: string }) {
  const transcript = trpc.agent.transcript.useQuery({ threadId });

  if (transcript.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const thread = transcript.data?.thread;
  const entries = transcript.data?.entries ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b pb-3">
        <MessageSquareText className="text-muted-foreground size-4 shrink-0" />
        <p className="text-muted-foreground text-xs">
          {thread
            ? `From ${formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}`
            : "Conversation"}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing was said in this conversation.</p>
      ) : (
        <div className="space-y-4">
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
      )}

      {thread?.viewId && (
        <Link
          href={`/views/${thread.viewId}`}
          className="text-foreground inline-block text-sm font-medium hover:underline"
        >
          Open the view this produced →
        </Link>
      )}
    </div>
  );
}
