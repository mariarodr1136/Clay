"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { FolderKanban, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
});

const avatarPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function avatarColor(seed: string) {
  const sum = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return avatarPalette[sum % avatarPalette.length];
}

export default function DashboardPage() {
  const utils = trpc.useUtils();
  const projectsQuery = trpc.projects.list.useQuery();
  const [open, setOpen] = useState(false);

  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setOpen(false);
      form.reset();
      toast.success("Project created");
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Everything you&apos;re tracking, in one place.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((values) => createProject.mutate(values))}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Website Relaunch" {...field} />
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
                <DialogFooter>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? "Creating…" : "Create project"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {projectsQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {projectsQuery.data && projectsQuery.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <FolderKanban className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No projects yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            Create your first project to start tracking tasks.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {projectsQuery.data?.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-14px_rgba(0,0,0,0.14)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: avatarColor(project.name) }}
                  >
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  {project.name}
                </CardTitle>
              </CardHeader>
              {project.description && (
                <CardContent className="text-muted-foreground text-sm leading-relaxed">
                  {project.description}
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
