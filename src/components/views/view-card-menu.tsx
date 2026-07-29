"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Per-card actions for the views gallery. The card itself is a Link, so
// every control here stops propagation — otherwise opening the menu would
// navigate into the view instead.
export function ViewCardMenu({ viewId, name }: { viewId: string; name: string }) {
  const utils = trpc.useUtils();
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const refresh = () => {
    utils.views.list.invalidate();
    utils.views.listTrash.invalidate();
  };

  const rename = trpc.views.rename.useMutation({
    onSuccess: (view) => {
      toast.success(`Renamed to "${view.name}"`);
      setRenameOpen(false);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.views.delete.useMutation({
    onSuccess: () => {
      toast.success("Moved to trash", {
        description: "Version history is kept — you can restore it from the trash.",
      });
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={stop}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${name}`}
            className="text-muted-foreground -mt-1 shrink-0"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <DropdownMenuItem
            onSelect={() => {
              setDraftName(name);
              setRenameOpen(true);
            }}
          >
            <PencilLine />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => remove.mutate({ viewId })}
            disabled={remove.isPending}
          >
            <Trash2 />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent onClick={stop}>
          <DialogHeader>
            <DialogTitle>Rename view</DialogTitle>
            <DialogDescription>
              Renaming is metadata only — it doesn&apos;t create a new version or change what the
              view shows.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = draftName.trim();
              if (trimmed) rename.mutate({ viewId, name: trimmed });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`rename-${viewId}`}>Name</Label>
              <Input
                id={`rename-${viewId}`}
                value={draftName}
                autoFocus
                maxLength={200}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={rename.isPending || !draftName.trim()}>
                {rename.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
