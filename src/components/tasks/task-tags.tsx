"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tag, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";

// Free-form labels on a task. No tag manager, no colour picker, no
// autocomplete backed by a tags table: typing a word and pressing enter is
// the whole interaction, and the agent can already chart them through the
// tasksByTag catalog query.
export function TaskTags({ taskId, tags }: { taskId: string; tags: string[] }) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState("");

  const setTags = trpc.tasks.setTags.useMutation({
    onSuccess: () => {
      utils.comments.taskDetail.invalidate();
      utils.tasks.listByProject.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    // Case-insensitive de-dupe, so "Frontend" and "frontend" don't both
    // exist and split every count the agent produces.
    if (!tag || tags.some((existing) => existing.toLowerCase() === tag)) {
      setDraft("");
      return;
    }
    setTags.mutate({ id: taskId, tags: [...tags, tag] });
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag className="text-muted-foreground size-3.5 shrink-0" />
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-muted text-muted-foreground flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            className="hover:text-foreground"
            onClick={() => setTags.mutate({ id: taskId, tags: tags.filter((t) => t !== tag) })}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        placeholder="Add tag…"
        aria-label="Add a tag"
        maxLength={24}
        className="h-6 w-28 border-none px-1.5 text-xs shadow-none focus-visible:ring-0"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
