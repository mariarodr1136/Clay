"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { taskPriorities, taskStatuses } from "@/server/db/schema";
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

const statusLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(4000).optional(),
  priority: z.enum(taskPriorities),
  dueDate: z.string().optional(),
});

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

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
    defaultValues: { title: "", description: "", priority: "medium", dueDate: "" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">{project.data?.name ?? "…"}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New task</Button>
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
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

      {statsQuery.data && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {statsQuery.data.statusCounts.map((s) => (
            <Badge key={s.status} variant="outline">
              {statusLabels[s.status] ?? s.status}: {s.count}
            </Badge>
          ))}
          {statsQuery.data.overdue.length > 0 && (
            <Badge variant="destructive">{statsQuery.data.overdue.length} overdue</Badge>
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
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksQuery.data.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
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
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {taskStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabels[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {task.dueDate ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTask.mutate({ id: task.id })}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {tasksQuery.data && tasksQuery.data.length === 0 && (
        <p className="text-muted-foreground text-sm">No tasks yet.</p>
      )}
    </div>
  );
}
