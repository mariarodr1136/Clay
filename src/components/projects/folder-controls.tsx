"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  FolderPlus,
  MoreHorizontal,
  PencilLine,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

export type Folder = {
  id: string;
  name: string;
  colorVar: string | null;
  projectCount: number;
};

// The palette folders are tinted from. Fixed tokens rather than a colour
// picker: five recognisable options beat a spectrum nobody wants to choose
// from, and they stay legible in both themes.
const FOLDER_COLORS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

export function NewFolderButton({ folderCount }: { folderCount: number }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = trpc.folders.create.useMutation({
    onSuccess: (folder) => {
      toast.success(`Created "${folder.name}"`);
      setName("");
      setOpen(false);
      utils.folders.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus data-icon="inline-start" />
        New folder
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Group related projects together. Projects can sit outside every folder, and deleting
              a folder never deletes what&apos;s in it.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (trimmed) {
                create.mutate({
                  name: trimmed,
                  // Cycles through the palette so consecutive folders don't
                  // land on the same colour.
                  colorVar: FOLDER_COLORS[folderCount % FOLDER_COLORS.length],
                });
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={name}
                autoFocus
                maxLength={80}
                placeholder="Client work"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending ? "Creating…" : "Create folder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FolderMenu({
  folder,
  index,
  order,
}: {
  folder: Folder;
  index: number;
  // Every folder id in display order, so a move is just a swap.
  order: string[];
}) {
  const utils = trpc.useUtils();
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  const refresh = () => {
    utils.folders.list.invalidate();
    utils.projects.listWithStats.invalidate();
  };

  const rename = trpc.folders.rename.useMutation({
    onSuccess: () => {
      setRenameOpen(false);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const reorder = trpc.folders.reorder.useMutation({
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });

  // Buttons rather than drag-and-drop: this is reachable from the keyboard
  // without inventing a whole drag interaction, and there are rarely enough
  // folders for dragging to be worth it.
  const swapWith = (target: number) => {
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ folderIds: next });
  };

  const remove = trpc.folders.delete.useMutation({
    onSuccess: () => {
      toast.success("Folder deleted", {
        description: "Its projects are still here, just ungrouped.",
      });
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${folder.name}`}
            className="text-muted-foreground"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(folder.name);
              setRenameOpen(true);
            }}
          >
            <PencilLine />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === 0} onSelect={() => swapWith(index - 1)}>
            <ArrowUp />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === order.length - 1}
            onSelect={() => swapWith(index + 1)}
          >
            <ArrowDown />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={remove.isPending}
            onSelect={() => remove.mutate({ folderId: folder.id })}
          >
            <Trash2 />
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = draft.trim();
              if (trimmed) rename.mutate({ folderId: folder.id, name: trimmed });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`rename-folder-${folder.id}`}>Name</Label>
              <Input
                id={`rename-folder-${folder.id}`}
                value={draft}
                autoFocus
                maxLength={80}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!draft.trim() || rename.isPending}>
                {rename.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProjectCardMenu({
  project,
  folders,
  onEdit,
}: {
  project: { id: string; name: string; folderId: string | null; pinnedAt: Date | string | null };
  folders: Folder[];
  onEdit: () => void;
}) {
  const utils = trpc.useUtils();

  const refresh = () => {
    utils.projects.listWithStats.invalidate();
    utils.projects.listArchived.invalidate();
    utils.folders.list.invalidate();
  };

  const move = trpc.projects.move.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const setPinned = trpc.projects.setPinned.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const archive = trpc.projects.archive.useMutation({
    onSuccess: () => {
      toast.success("Project archived", { description: "Nothing was deleted — restore it any time." });
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  // The card is a link, so every control here has to stop the click from
  // navigating into the project.
  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const pinned = Boolean(project.pinnedAt);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={stop}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${project.name}`}
          className="text-muted-foreground -mt-1 shrink-0"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        <DropdownMenuItem
          onSelect={() => setPinned.mutate({ id: project.id, pinned: !pinned })}
        >
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? "Unpin" : "Pin to top"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <PencilLine />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={project.folderId === null}
          onSelect={() => move.mutate({ projectId: project.id, folderId: null })}
        >
          No folder
        </DropdownMenuItem>
        {folders.map((folder) => (
          <DropdownMenuItem
            key={folder.id}
            disabled={folder.id === project.folderId}
            onSelect={() => move.mutate({ projectId: project.id, folderId: folder.id })}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: `var(${folder.colorVar ?? "--chart-1"})` }}
            />
            {folder.name}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={archive.isPending}
          onSelect={() => archive.mutate({ id: project.id, archived: true })}
        >
          <Archive />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
