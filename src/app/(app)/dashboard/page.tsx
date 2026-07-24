"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Database,
  FolderKanban,
  MessageSquareText,
  Plus,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function StatTile({
  label,
  value,
  sub,
  subColorVar,
  valueColorVar,
}: {
  label: string;
  value: string;
  sub?: string;
  subColorVar?: string;
  valueColorVar?: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p
          className="mt-1 text-2xl font-semibold tracking-tight"
          style={valueColorVar ? { color: `var(${valueColorVar})` } : undefined}
        >
          {value}
        </p>
        {sub && (
          <p
            className="text-muted-foreground mt-0.5 text-xs"
            style={subColorVar ? { color: `var(${subColorVar})` } : undefined}
          >
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingHero({
  onCreateClick,
  onSeedClick,
  seeding,
}: {
  onCreateClick: () => void;
  onSeedClick: () => void;
  seeding: boolean;
}) {
  const steps = [
    {
      icon: FolderKanban,
      title: "Create a project",
      body: "Projects hold your tasks — statuses, priorities, and due dates.",
    },
    {
      icon: MessageSquareText,
      title: "Ask for a dashboard",
      body: "Describe the view you want in Chat and the agent builds it against your data.",
    },
    {
      icon: Sparkles,
      title: "Refine and publish",
      body: "Iterate in conversation, keep every version, publish the good ones org-wide.",
    },
  ];

  return (
    <div className="border-border bg-card rounded-3xl border p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)] sm:p-10">
      <div className="max-w-2xl space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome to your workspace</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          It&apos;s empty right now — that changes fast. Track work in projects, then ask the agent
          for any dashboard in plain language: charts, KPIs, filters, and tables, built live
          against your real tasks and refined in conversation.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={step.title} className="border-border/70 bg-background/50 rounded-2xl border p-4">
            <div className="flex items-center gap-2.5">
              <span className="bg-accent text-accent-foreground flex size-7 items-center justify-center rounded-full text-xs font-semibold">
                {i + 1}
              </span>
              <step.icon className="text-muted-foreground size-4" />
            </div>
            <p className="mt-3 text-sm font-semibold">{step.title}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button onClick={onCreateClick}>
          <Plus data-icon="inline-start" />
          Create your first project
        </Button>
        <Button variant="outline" onClick={onSeedClick} disabled={seeding}>
          <Database data-icon="inline-start" />
          {seeding ? "Loading sample workspace…" : "Load a sample workspace"}
        </Button>
        <Link
          href="/demo"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium"
        >
          See a fully loaded example
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const utils = trpc.useUtils();
  const projectsQuery = trpc.projects.listWithStats.useQuery();
  const [open, setOpen] = useState(false);

  const invalidate = () => {
    utils.projects.listWithStats.invalidate();
    utils.projects.list.invalidate();
  };

  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      invalidate();
      setOpen(false);
      form.reset();
      toast.success("Project created");
    },
    onError: (err) => toast.error(err.message),
  });

  const seedSample = trpc.projects.seedSample.useMutation({
    onSuccess: () => {
      invalidate();
      utils.views.list.invalidate();
      toast.success("Sample workspace loaded — explore the project and its views");
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "" },
  });

  const projects = projectsQuery.data ?? [];
  const totals = projects.reduce(
    (acc, p) => ({
      total: acc.total + p.total,
      done: acc.done + p.done,
      inFlight: acc.inFlight + p.inFlight,
      overdue: acc.overdue + p.overdue,
    }),
    { total: 0, done: 0, inFlight: 0, overdue: 0 }
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between gap-4">
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

      {projectsQuery.data && projects.length === 0 && (
        <OnboardingHero
          onCreateClick={() => setOpen(true)}
          onSeedClick={() => seedSample.mutate()}
          seeding={seedSample.isPending}
        />
      )}

      {projects.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Active projects" value={String(projects.length)} />
            <StatTile
              label="Open tasks"
              value={String(totals.total - totals.done)}
              sub={`${totals.inFlight} in flight`}
            />
            <StatTile label="Completed" value={String(totals.done)} sub="all time" />
            <StatTile
              label="Overdue"
              value={String(totals.overdue)}
              valueColorVar={totals.overdue > 0 ? "--destructive" : undefined}
              sub="across all projects"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const percentDone =
                project.total === 0 ? 0 : Math.round((project.done / project.total) * 100);
              const color = avatarColor(project.name);
              return (
                <Link key={project.id} href={`/projects/${project.id}`} className="group">
                  <Card className="h-full gap-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-14px_rgba(0,0,0,0.14)]">
                    <CardContent className="flex h-full flex-col gap-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {project.name.slice(0, 1).toUpperCase()}
                        </span>
                        {project.overdue > 0 && (
                          <span className="text-destructive text-[11px] font-medium">
                            {project.overdue} overdue
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h2 className="flex items-center gap-1 font-semibold tracking-tight">
                          {project.name}
                          <ArrowUpRight className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </h2>
                        {project.description && (
                          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                            {project.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-auto">
                        <div className="text-muted-foreground mb-1 flex justify-between text-[11px] font-medium">
                          <span>
                            {project.done}/{project.total} done
                          </span>
                          <span className="tabular-nums">{percentDone}%</span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden rounded-full"
                          style={{
                            backgroundColor: `color-mix(in oklch, ${color}, transparent 88%)`,
                          }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percentDone}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
