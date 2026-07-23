import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, MessageSquareText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-12rem] -z-10 flex justify-center blur-3xl"
      >
        <div className="aspect-[3/1] w-[80rem] bg-gradient-to-tr from-[oklch(0.85_0.09_264)] via-[oklch(0.92_0.06_300)] to-[oklch(0.89_0.08_200)] opacity-50" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Clay</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Plain <a>, not next/link — see note below on the hero CTAs. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/sign-in">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </a>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 pt-12 pb-20 text-center sm:pt-16">
        <span className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium tracking-wide text-primary-foreground uppercase">
          <Sparkles className="size-3.5" />
          Dynamic software interfaces
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Ask your interface into existence.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-balance sm:text-xl">
          Clay is a project tracker where the UI isn&apos;t fixed. Describe the
          dashboard you need, and a coding agent builds it — live, against your real data.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {/* Plain <a>, not next/link: these are the first-ever navigation
              into Clerk's UI for a fresh browser session, which needs a full
              page load to complete Clerk's dev-instance handshake redirect.
              A client-side soft nav can skip that and hang until a refresh. */}
          <Button asChild size="lg">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-up" className="group">
              Get started
              <ArrowRight
                data-icon="inline-end"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-in">Sign in</a>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 pb-24 sm:pb-32">
        <div className="rounded-3xl bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_30px_60px_-20px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.05] sm:p-4">
          <div className="grid gap-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-3 sm:p-6">
            <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] sm:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-md bg-[var(--chart-1)] text-[9px] font-semibold text-white">
                    W
                  </span>
                  <span className="text-xs font-medium">Website Relaunch</span>
                  <span className="text-muted-foreground text-xs">· Tasks by status</span>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--status-in-progress),transparent_85%)] px-2 py-0.5 text-[10px] font-medium text-(--status-in-progress)">
                  <span className="size-1.5 rounded-full bg-current" />
                  live
                </span>
              </div>
              <div className="flex h-24 items-end gap-2.5">
                {[
                  { h: "45%", c: "var(--status-todo)", label: "Backlog", value: 6 },
                  { h: "85%", c: "var(--status-in-progress)", label: "In Progress", value: 11 },
                  { h: "60%", c: "var(--status-in-review)", label: "In Review", value: 8 },
                  { h: "100%", c: "var(--status-done)", label: "Done", value: 13 },
                  { h: "30%", c: "var(--status-todo)", label: "Todo", value: 4 },
                ].map((bar, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-semibold" style={{ color: bar.c }}>
                      {bar.value}
                    </span>
                    <div
                      className="w-full rounded-t-md"
                      style={{ height: bar.h, backgroundColor: bar.c, opacity: 0.85 }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2.5">
                {["Backlog", "In Progress", "In Review", "Done", "Todo"].map((label, i) => (
                  <span
                    key={i}
                    className="text-muted-foreground flex-1 truncate text-center text-[9px]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between gap-3">
              <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04]">
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-semibold">32</p>
                  <span className="text-[10px] font-medium text-(--status-in-progress)">+3 today</span>
                </div>
                <p className="text-xs text-muted-foreground">Open tasks</p>
              </div>
              <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04]">
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-semibold text-(--status-done)">18</p>
                  <span className="text-[10px] font-medium text-(--status-done)">↑ 20%</span>
                </div>
                <p className="text-xs text-muted-foreground">Done this week</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="w-full py-20 sm:py-28"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--background) 0%, color-mix(in oklab, var(--accent) 45%, var(--background)) 16%, color-mix(in oklab, var(--accent) 45%, var(--background)) 84%, var(--background) 100%)",
        }}
      >
        <div className="mx-auto max-w-5xl px-6">
          {/* Feature 1 — real project data */}
          <div className="grid items-center gap-10 sm:grid-cols-2 sm:gap-16">
            <div className="order-2 space-y-4 sm:order-1">
              <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                Real data, not a demo
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                Every view is built against your actual projects.
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                No mock JSON, no seed data pretending to be real. The moment you create a
                project and add tasks, every dashboard you generate reads from that same
                live database.
              </p>
            </div>
            <div className="order-1 sm:order-2">
              <div className="rounded-2xl bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_50px_-18px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.05]">
                <div className="grid gap-2.5 rounded-xl bg-muted/50 p-3">
                  {[
                    { name: "Website Relaunch", color: "var(--chart-1)", tasks: "12 open" },
                    { name: "Mobile App v2", color: "var(--chart-2)", tasks: "8 open" },
                    { name: "Q3 Marketing", color: "var(--chart-3)", tasks: "5 open" },
                  ].map((project) => (
                    <div
                      key={project.name}
                      className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-sm ring-1 ring-black/[0.04]"
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: project.color }}
                      >
                        {project.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <p className="text-muted-foreground text-xs">{project.tasks}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
        {/* Feature 2 — ask, don't configure */}
        <div className="grid items-center gap-10 sm:grid-cols-2 sm:gap-16">
          <div className="space-y-4">
            <span className="text-xs font-semibold tracking-wide text-primary uppercase">
              Ask, don&apos;t configure
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Describe the dashboard you want in plain language.
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Skip the drag-and-drop builder. Type what you&apos;re looking for and a
              coding agent writes the interface, wires it to your data, and renders it —
              in seconds.
            </p>
          </div>
          <div>
            <div className="space-y-2.5 rounded-2xl bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_50px_-18px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.05]">
              <div className="flex items-start justify-end gap-2 px-1 pt-1">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  Show tasks by status as a bar chart
                </div>
              </div>
              <div className="flex items-start gap-2 px-1">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent">
                  <MessageSquareText className="size-3.5 text-accent-foreground" />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2 text-sm">
                  Built it — here&apos;s your view.
                </div>
              </div>
              <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                <div className="flex h-16 items-end gap-2 rounded-lg bg-card p-2.5 shadow-sm ring-1 ring-black/[0.04]">
                  {[
                    { h: "40%", c: "var(--status-todo)" },
                    { h: "75%", c: "var(--status-in-progress)" },
                    { h: "55%", c: "var(--status-in-review)" },
                    { h: "95%", c: "var(--status-done)" },
                  ].map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{ height: bar.h, backgroundColor: bar.c, opacity: 0.85 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="w-full py-20 sm:py-28"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--background) 0%, color-mix(in oklab, var(--accent) 45%, var(--background)) 16%, color-mix(in oklab, var(--accent) 45%, var(--background)) 84%, var(--background) 100%)",
        }}
      >
        <div className="mx-auto max-w-5xl px-6">
          {/* Feature 3 — refine in conversation */}
          <div className="grid items-center gap-10 sm:grid-cols-2 sm:gap-16">
            <div className="order-2 space-y-4 sm:order-1">
              <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                Refine in conversation
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                &ldquo;Make this chart bigger.&rdquo; Nothing is ever lost.
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Every change is a new version, not an overwrite. Step back through past
                iterations any time, or keep pushing a view forward with another request.
              </p>
            </div>
            <div className="order-1 sm:order-2">
              <div className="space-y-2 rounded-2xl bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_50px_-18px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.05]">
                {[
                  { v: "v1", label: "Bar chart", active: false },
                  { v: "v2", label: "+ larger layout", active: false },
                  { v: "v3", label: "+ status colors", active: true },
                ].map((version) => (
                  <div
                    key={version.v}
                    className={`flex items-center gap-3 rounded-lg p-2.5 ${
                      version.active
                        ? "bg-accent ring-1 ring-black/[0.04]"
                        : "bg-muted/50"
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        version.active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {version.v}
                    </span>
                    <span
                      className={`text-sm ${version.active ? "font-medium" : "text-muted-foreground"}`}
                    >
                      {version.label}
                    </span>
                    {version.active && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        current
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
