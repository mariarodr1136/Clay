import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Database, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    title: "Real data, not a demo",
    body: "Every view is built against your actual projects and tasks — never a mockup.",
    icon: Database,
  },
  {
    title: "Ask, don't configure",
    body: "Describe the dashboard you want in plain language and watch it appear.",
    icon: Sparkles,
  },
  {
    title: "Refine in conversation",
    body: "“Make this chart bigger.” Every change is a new version — nothing is ever lost.",
    icon: History,
  },
];

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
          <span className="text-[15px] font-semibold tracking-tight">SelfSoftware</span>
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
        <span className="rounded-full bg-muted px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Dynamic software interfaces
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Ask your interface into existence.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-balance sm:text-xl">
          SelfSoftware is a project tracker where the UI isn&apos;t fixed. Describe the
          dashboard you need, and a coding agent builds it — live, against your real data.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {/* Plain <a>, not next/link: these are the first-ever navigation
              into Clerk's UI for a fresh browser session, which needs a full
              page load to complete Clerk's dev-instance handshake redirect.
              A client-side soft nav can skip that and hang until a refresh. */}
          <Button asChild size="lg">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-up">Get started</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-in">Sign in</a>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 pb-20 sm:pb-24">
        <div className="rounded-3xl bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_30px_60px_-20px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.05] sm:p-4">
          <div className="grid gap-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-3 sm:p-6">
            <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tasks by status</span>
                <span className="rounded-full bg-[color-mix(in_oklch,var(--status-in-progress),transparent_85%)] px-2 py-0.5 text-[10px] font-medium text-(--status-in-progress)">
                  live
                </span>
              </div>
              <div className="flex h-24 items-end gap-2.5">
                {[
                  { h: "45%", c: "var(--status-todo)" },
                  { h: "85%", c: "var(--status-in-progress)" },
                  { h: "60%", c: "var(--status-in-review)" },
                  { h: "100%", c: "var(--status-done)" },
                  { h: "30%", c: "var(--status-todo)" },
                ].map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md"
                    style={{ height: bar.h, backgroundColor: bar.c, opacity: 0.85 }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between gap-3">
              <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04]">
                <p className="text-2xl font-semibold">32</p>
                <p className="text-xs text-muted-foreground">Open tasks</p>
              </div>
              <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04]">
                <p className="text-2xl font-semibold text-(--status-done)">18</p>
                <p className="text-xs text-muted-foreground">Done this week</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-4 px-6 pb-24 sm:grid-cols-3 sm:pb-32">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]"
          >
            <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-accent">
              <feature.icon className="size-4.5 text-accent-foreground" />
            </div>
            <h2 className="text-sm font-semibold">{feature.title}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
