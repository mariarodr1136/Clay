"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Radix Select treats "" as "no value", so clearing needs a sentinel.
const NONE = "__none__";

export type EditableProject = {
  id: string;
  name: string;
  description: string | null;
  leadId?: string | null;
  targetDate: string | null;
};

// Lead and target date existed as columns before anything could set them —
// they arrived with the project header and were only ever reachable by
// seeding. This is the form that closes that gap.
export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
}: {
  project: EditableProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const members = trpc.members.list.useQuery(undefined, { enabled: open });

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [leadId, setLeadId] = useState(project?.leadId ?? NONE);
  const [targetDate, setTargetDate] = useState(project?.targetDate ?? "");
  // Re-seed the fields whenever a different project is opened, without an
  // effect: React re-runs this before painting, so nothing flashes.
  const [loadedFor, setLoadedFor] = useState<string | null>(project?.id ?? null);
  if (project && loadedFor !== project.id) {
    setLoadedFor(project.id);
    setName(project.name);
    setDescription(project.description ?? "");
    setLeadId(project.leadId ?? NONE);
    setTargetDate(project.targetDate ?? "");
  }

  const update = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("Project updated");
      utils.projects.listWithStats.invalidate();
      utils.projects.get.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            The lead and target date show in the project header, and the target date feeds the
            health badge.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!project || !name.trim()) return;
            update.mutate({
              id: project.id,
              name: name.trim(),
              description: description.trim() || null,
              leadId: leadId === NONE ? null : leadId,
              targetDate: targetDate || null,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              rows={2}
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-lead">Lead</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger id="project-lead" className="w-full">
                  <SelectValue placeholder="No lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No lead</SelectItem>
                  {(members.data ?? []).map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-target">Target date</Label>
              <Input
                id="project-target"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
