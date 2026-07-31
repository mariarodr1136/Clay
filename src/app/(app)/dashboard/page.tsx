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
  Pin,
  Plus,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  FolderMenu,
  ProjectCardMenu,
  NewFolderButton,
  type Folder,
} from "@/components/projects/folder-controls";
import { ProjectEditDialog } from "@/components/projects/project-edit-dialog";
import { ArchivedProjects } from "@/components/projects/archived-projects";
import { type ProjectHealth } from "@/lib/project-health";
import { HealthBadge } from "@/components/projects/health-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const foldersQuery = trpc.folders.list.useQuery();
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<"recent" | "name" | "progress" | "overdue">("recent");
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    description: string | null;
    targetDate: string | null;
  } | null>(null);

  const invalidate = () => {
    utils.projects.listWithStats.invalidate();
    utils.projects.list.invalidate();
    utils.folders.list.invalidate();
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

  const allProjects = projectsQuery.data ?? [];
  const folders: Folder[] = foldersQuery.data ?? [];

  // Sorting applies inside every group rather than flattening them — the
  // folders are the arrangement, this is the order within it.
  const compare = {
    recent: (a: (typeof allProjects)[number], b: (typeof allProjects)[number]) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    name: (a: (typeof allProjects)[number], b: (typeof allProjects)[number]) =>
      a.name.localeCompare(b.name),
    progress: (a: (typeof allProjects)[number], b: (typeof allProjects)[number]) =>
      (b.total === 0 ? 0 : b.done / b.total) - (a.total === 0 ? 0 : a.done / a.total),
    overdue: (a: (typeof allProjects)[number], b: (typeof allProjects)[number]) =>
      b.overdue - a.overdue,
  }[sort];

  const projects = [...allProjects].sort(compare);
  const pinned = projects.filter((project) => project.pinnedAt);

  // Folders in their configured order, then whatever isn't in one. Empty
  // folders still appear — a folder you just made shouldn't look like it
  // failed to save.
  const groups = [
    ...folders.map((folder) => ({
      key: folder.id,
      folder,
      projects: projects.filter((project) => project.folderId === folder.id),
    })),
    {
      key: "__ungrouped__",
      folder: null,
      projects: projects.filter(
        (project) => !folders.some((folder) => folder.id === project.folderId)
      ),
    },
  ].filter((group) => group.folder !== null || group.projects.length > 0);
  const totals = projects.reduce(
    (acc, p) => ({
      total: acc.total + p.total,
      done: acc.done + p.done,
      inFlight: acc.inFlight + p.inFlight,
      overdue: acc.overdue + p.overdue,
    }),
    { total: 0, done: 0, inFlight: 0, overdue: 0 }
  );

  // One card renderer, used by both the pinned group and the folders — the
  // markup is identical and only the list differs.
  const renderProjectCard = (project: (typeof projects)[number]) => {

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
                        <div className="flex items-center gap-1">
                          {project.overdue > 0 && (
                            <span className="text-destructive text-[11px] font-medium">
                              {project.overdue} overdue
                            </span>
                          )}
                          <ProjectCardMenu
                            project={project}
                            folders={folders}
                            onEdit={() => setEditing(project)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <HealthBadge
                          health={project.health as ProjectHealth}
                          reason={project.reason}
                        />
                        <h2 className="flex items-center gap-1 font-semibold tracking-tight">
                          {project.pinnedAt && (
                            <Pin className="text-muted-foreground size-3.5 shrink-0" />
                          )}
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
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Wraps rather than sitting on one line: the sort picker and two
          buttons come to ~435px, which a phone doesn't have, and an
          unwrapped row put the whole page into horizontal scroll. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Everything you&apos;re tracking, in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {projects.length > 0 && (
          <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently active</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
              <SelectItem value="overdue">Most overdue</SelectItem>
            </SelectContent>
          </Select>
        )}
        {projects.length > 0 && <NewFolderButton folderCount={folders.length} />}
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

          {pinned.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <Pin className="size-3.5" />
                Pinned
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pinned.map(renderProjectCard)}
              </div>
            </section>
          )}

          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              {group.folder ? (
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor: `var(${group.folder.colorVar ?? "--chart-1"})`,
                    }}
                  />
                  <h2 className="text-sm font-semibold tracking-tight">{group.folder.name}</h2>
                  <span className="text-muted-foreground text-xs">
                    {group.projects.length}
                  </span>
                  <FolderMenu
                    folder={group.folder}
                    index={folders.findIndex((f) => f.id === group.folder!.id)}
                    order={folders.map((f) => f.id)}
                  />
                </div>
              ) : (
                // Only worth a heading once there's something to contrast
                // it with — an unfoldered workspace shouldn't grow a
                // "No folder" label out of nowhere.
                folders.length > 0 && (
                  <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    No folder
                  </h2>
                )
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.projects.map(renderProjectCard)}
              </div>
            </section>
          ))}

          <ArchivedProjects />
        </>
      )}

      <ProjectEditDialog
        project={editing}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      />
    </div>
  );
}
