"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { CheckSquare, Plus, Trash2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { taskPriorities, taskStatuses } from "@/server/db/schema";
import { statusMeta } from "@/lib/task-display";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog";
import { ProjectHeader } from "@/components/tasks/project-header";
import { ImportDialog } from "@/components/tasks/import-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(4000).optional(),
  priority: z.enum(taskPriorities),
  dueDate: z.string().optional(),
  points: z.number().int().min(0).max(100).optional(),
});

function DueCell({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (!dueDate) return <span className="text-muted-foreground text-sm">—</span>;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = status !== "done" && dueDate < today;
  return (
    <span
      className={cn("text-sm", overdue ? "text-destructive font-medium" : "text-muted-foreground")}
    >
      {format(parseISO(dueDate), "MMM d")}
      {overdue && " · overdue"}
    </span>
  );
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof taskStatuses)[number] | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const project = trpc.projects.get.useQuery({ id: projectId });
  const tasksQuery = trpc.tasks.listByProject.useQuery({ projectId });
  const statsQuery = trpc.tasks.stats.useQuery({ projectId });

  const invalidateAll = () => {
    utils.tasks.listByProject.invalidate({ projectId });
    utils.tasks.stats.invalidate({ projectId });
  };

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      setOpen(false);
      form.reset();
      toast.success("Task created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: invalidateAll,
    onError: (err) => toast.error(err.message),
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: invalidateAll,
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<z.infer<typeof createTaskSchema>>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { title: "", description: "", priority: "medium", dueDate: "", points: 0 },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{project.data?.name ?? "…"}</h1>
          {project.data?.description && (
            <p className="text-muted-foreground max-w-xl text-sm">{project.data.description}</p>
          )}
          {project.data && (
            <ProjectHeader
              lead={project.data.lead}
              members={project.data.members}
              targetDate={project.data.targetDate}
              openPoints={project.data.stats.openPoints}
              overdue={project.data.stats.overdue}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload data-icon="inline-start" />
          Import
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus data-icon="inline-start" />
              New task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((values) =>
                  createTask.mutate({
                    projectId,
                    title: values.title,
                    description: values.description || undefined,
                    priority: values.priority,
                    dueDate: values.dueDate || undefined,
                    points: values.points ?? 0,
                  })
                )}
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Fix broken redirects" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taskPriorities.map((p) => (
                            <SelectItem key={p} value={p}>
                              <PriorityBadge priority={p} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="points"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Points</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createTask.isPending}>
                    {createTask.isPending ? "Creating…" : "Create task"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <ImportDialog projectId={projectId} open={importOpen} onOpenChange={setImportOpen} />

      {statsQuery.data && (tasksQuery.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter(null)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All · {tasksQuery.data?.length ?? 0}
          </button>
          {taskStatuses.map((status) => {
            const count =
              statsQuery.data.statusCounts.find((s) => s.status === status)?.count ?? 0;
            const active = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(active ? null : status)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {statusMeta[status].label} · {count}
              </button>
            );
          })}
          {statsQuery.data.overdue.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {statsQuery.data.overdue.length} overdue
            </Badge>
          )}
        </div>
      )}

      {tasksQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {tasksQuery.data && tasksQuery.data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Pts</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(statusFilter
                ? tasksQuery.data.filter((t) => t.status === statusFilter)
                : tasksQuery.data
              ).map((task) => (
                <TableRow key={task.id} className="group/row">
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => setDetailTaskId(task.id)}
                    >
                      {task.title}
                    </button>
                    {task.tags.length > 0 && (
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {task.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(status) =>
                        updateStatus.mutate({
                          id: task.id,
                          status: status as (typeof taskStatuses)[number],
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="w-40 border-transparent bg-transparent hover:bg-muted">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {taskStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            <StatusBadge status={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>
                    <DueCell dueDate={task.dueDate} status={task.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                    {task.points > 0 ? task.points : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete task"
                      className="text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteTask.mutate({ id: task.id })}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {tasksQuery.data && tasksQuery.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <CheckSquare className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No tasks yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            Add your first task to start tracking progress on this project.
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" />
            Add a task
          </Button>
        </div>
      )}

      <TaskDetailDialog
        taskId={detailTaskId}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
      />
    </div>
  );
}
