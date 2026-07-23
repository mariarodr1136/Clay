import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/theme-toggle";
import type { taskPriorities, taskStatuses } from "@/server/db/schema";

// Static mirror of seed-demo-data.ts — same project, same tasks — so a demo
// visitor sees exactly what a brand-new real sign-up sees. No auth, no DB
// reads or writes: this route is intentionally public and read-only.
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const demoTasks: {
  title: string;
  status: (typeof taskStatuses)[number];
  priority: (typeof taskPriorities)[number];
  dueDate: string;
}[] = [
  { title: "Audit current site content", status: "done", priority: "medium", dueDate: daysFromNow(-6) },
  { title: "Design new pricing page", status: "in_review", priority: "high", dueDate: daysFromNow(-1) },
  { title: "Migrate blog to new CMS", status: "in_progress", priority: "medium", dueDate: daysFromNow(4) },
  { title: "Set up staging environment", status: "in_progress", priority: "urgent", dueDate: daysFromNow(2) },
  { title: "Write launch announcement", status: "todo", priority: "low", dueDate: daysFromNow(10) },
  { title: "QA pass on mobile breakpoints", status: "todo", priority: "high", dueDate: daysFromNow(7) },
  { title: "Fix broken redirects from old URLs", status: "todo", priority: "urgent", dueDate: daysFromNow(-2) },
];

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
              <span className="text-[15px] font-semibold tracking-tight">Clay</span>
            </Link>
            <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              <Sparkles className="size-3" />
              Demo mode
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-up">
              <Button size="sm">Sign up</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-10 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-border bg-muted/40 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              You&apos;re viewing sample data in a read-only demo. Nothing here is
              saved, and no account is required to look around.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-up" className="shrink-0">
              <Button size="sm" variant="outline">
                Create your own workspace
              </Button>
            </a>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Everything you&apos;re tracking, in one place.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-base">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--chart-1)] text-xs font-semibold text-white">
                  W
                </span>
                Website Relaunch
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Rebuild the marketing site and ship the new pricing page.
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoTasks.map((task) => (
                  <TableRow key={task.title}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{task.dueDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
