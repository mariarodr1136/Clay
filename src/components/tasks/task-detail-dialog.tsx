"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { TaskTags } from "@/components/tasks/task-tags";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select treats "" as "no value", which would make the unassigned
// option unselectable — so it carries an explicit sentinel instead.
const UNASSIGNED = "__unassigned__";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VERB_LABELS: Record<string, string> = {
  "task.created": "created this task",
  "task.status_changed": "changed the status",
  "task.assigned": "changed the assignee",
  "task.due_date_changed": "changed the due date",
};

function HistoryLine({
  actorName,
  verb,
  metadata,
  createdAt,
}: {
  actorName: string | null;
  verb: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | Date;
}) {
  const detail =
    verb === "task.status_changed" && typeof metadata?.status === "string"
      ? ` to ${metadata.status.replace(/_/g, " ")}`
      : "";

  return (
    <li className="text-muted-foreground flex items-baseline gap-2 text-xs">
      <span className="bg-border size-1.5 shrink-0 rounded-full" />
      <span>
        <span className="text-foreground font-medium">{actorName ?? "Someone"}</span>{" "}
        {VERB_LABELS[verb] ?? verb}
        {detail}
      </span>
      <span className="ml-auto shrink-0" title={new Date(createdAt).toLocaleString()}>
        {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
      </span>
    </li>
  );
}

// Opened from a row on the project board. Everything it shows already
// existed in the schema — the comments table and the activity log were both
// being written and never read.
export function TaskDetailDialog({
  taskId,
  onOpenChange,
}: {
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState("");

  const detailQuery = trpc.comments.taskDetail.useQuery(
    { taskId: taskId ?? "" },
    { enabled: Boolean(taskId) }
  );

  const membersQuery = trpc.members.list.useQuery(undefined, { enabled: Boolean(taskId) });

  const assign = trpc.tasks.assign.useMutation({
    onSuccess: () => {
      utils.comments.taskDetail.invalidate();
      utils.tasks.listByProject.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const addComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.comments.taskDetail.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteComment = trpc.comments.delete.useMutation({
    onSuccess: () => utils.comments.taskDetail.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const detail = detailQuery.data;

  return (
    <Dialog open={Boolean(taskId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {detailQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {detail && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-left leading-snug">
                {detail.task.title}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.task.status} />
              <PriorityBadge priority={detail.task.priority} />
              {detail.task.dueDate && (
                <span className="text-muted-foreground text-xs">
                  Due {format(parseISO(detail.task.dueDate), "MMM d, yyyy")}
                </span>
              )}
              {detail.task.points > 0 && (
                <span className="text-muted-foreground text-xs">{detail.task.points} pts</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Assignee</span>
              <Select
                value={detail.task.assigneeId ?? UNASSIGNED}
                onValueChange={(value) =>
                  taskId &&
                  assign.mutate({ id: taskId, assigneeId: value === UNASSIGNED ? null : value })
                }
              >
                <SelectTrigger size="sm" className="w-56">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {(membersQuery.data ?? []).map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TaskTags taskId={detail.task.id} tags={detail.task.tags ?? []} />

            {detail.task.description && (
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {detail.task.description}
              </p>
            )}

            <Separator />

            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <MessageSquare className="size-3.5" />
                Comments
                {detail.comments.length > 0 && (
                  <span className="text-muted-foreground">({detail.comments.length})</span>
                )}
              </h3>

              {detail.comments.length === 0 && (
                <p className="text-muted-foreground text-sm">No comments yet.</p>
              )}

              <ul className="space-y-3">
                {detail.comments.map((comment) => (
                  <li key={comment.id} className="group/comment flex gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2 text-xs">
                        <span className="font-medium">{comment.authorName ?? "Unknown"}</span>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete comment"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover/comment:opacity-100"
                      onClick={() => deleteComment.mutate({ commentId: comment.id })}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>

              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = draft.trim();
                  if (body && taskId) addComment.mutate({ taskId, body });
                }}
              >
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Leave a comment…"
                  rows={2}
                  maxLength={4000}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!draft.trim() || addComment.isPending}
                  className="self-start"
                >
                  {addComment.isPending ? "Posting…" : "Comment"}
                </Button>
              </form>
            </section>

            {detail.history.length > 0 && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold tracking-wide uppercase">History</h3>
                  <ul className="space-y-1.5">
                    {detail.history.map((entry) => (
                      <HistoryLine
                        key={entry.id}
                        actorName={entry.actorName}
                        verb={entry.verb}
                        metadata={entry.metadata}
                        createdAt={entry.createdAt}
                      />
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
