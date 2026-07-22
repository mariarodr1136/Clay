"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New project</Button>
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
        <p className="text-muted-foreground text-sm">No projects yet. Create one to get started.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {projectsQuery.data?.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
              </CardHeader>
              {project.description && (
                <CardContent className="text-muted-foreground text-sm">
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
