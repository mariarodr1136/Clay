"use client";

import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

// The archive, and the only route to a permanent delete.
//
// Deleting a project used to sit one slip away in a menu and destroy every
// task in it with no undo. Archiving is the reversible action people
// actually mean; purging is deliberately two steps from anywhere.
export function ArchivedProjects() {
  const utils = trpc.useUtils();
  const archived = trpc.projects.listArchived.useQuery();

  const refresh = () => {
    utils.projects.listArchived.invalidate();
    utils.projects.listWithStats.invalidate();
    utils.projects.list.invalidate();
  };

  const restore = trpc.projects.archive.useMutation({
    onSuccess: () => {
      toast.success("Project restored");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const purge = trpc.projects.purge.useMutation({
    onSuccess: () => {
      toast.success("Project deleted permanently");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = archived.data ?? [];
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Archived
      </h2>
      <div className="border-border divide-border divide-y rounded-2xl border">
        {items.map((project) => (
          <div key={project.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{project.name}</p>
              <p className="text-muted-foreground text-xs">
                Archived{" "}
                {project.archivedAt
                  ? formatDistanceToNow(new Date(project.archivedAt), { addSuffix: true })
                  : "recently"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={restore.isPending}
                onClick={() => restore.mutate({ id: project.id, archived: false })}
              >
                Restore
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                disabled={purge.isPending}
                onClick={() => purge.mutate({ id: project.id })}
              >
                Delete forever
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
