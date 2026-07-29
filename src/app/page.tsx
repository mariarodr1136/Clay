import { optionalClerkUserId } from "@/server/auth/clerk-optional";
import { redirect } from "next/navigation";
import { Fraunces } from "next/font/google";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Check,
  Circle,
  Code,
  CirclePlay,
  DollarSign,
  GitBranch,
  History,
  Lightbulb,
  MessageSquareText,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
});

const REPO_URL = "https://github.com/mariarodr1136/Clay";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default async function Home() {
  // Not auth() directly: a demo visitor reaches this page with Clerk's
  // middleware deliberately skipped, and auth() throws in that state rather
  // than reporting a signed-out user.
  const userId = await optionalClerkUserId();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5 sm:px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
              <span className="text-[15px] font-semibold tracking-tight">Clay</span>
            </div>
            <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground sm:flex">
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#deploy" className="transition-colors hover:text-foreground">
                Deploy
              </a>
              <a href="#use-cases" className="transition-colors hover:text-foreground">
                Use Cases
              </a>
              <a href="#faq" className="transition-colors hover:text-foreground">
                FAQ
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Clay on GitHub"
              className="flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
            >
              <GitHubMark className="size-5" />
            </a>
            {/* Plain <a>, not next/link — see note below on the hero CTAs. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-in">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklch, var(--foreground), transparent 88%) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to bottom, black 60%, transparent)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[-14rem] -z-10 flex justify-center blur-3xl"
        >
          <div className="aspect-[3/1] w-[80rem] bg-gradient-to-tr from-[oklch(0.85_0.09_264)] via-[oklch(0.92_0.06_300)] to-[oklch(0.89_0.08_200)] opacity-40" />
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-6 pt-16 pb-20 text-center sm:pt-24 sm:pb-24">
          <a
            href="#features"
            className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <Sparkles className="size-3.5 text-primary" />
            Dynamic software interfaces
            <ArrowRight className="size-3.5" />
          </a>
          <h1
            className={`${fraunces.className} text-5xl leading-[1.02] font-medium tracking-tight text-balance sm:text-7xl lg:text-8xl`}
          >
            Ask for it.
            <br />
            <span className="text-primary">Watch it appear.</span>
          </h1>
          <p className="max-w-xl text-lg text-balance text-muted-foreground sm:text-xl">
            A project tracker where the UI isn&apos;t fixed. Describe the dashboard
            you need — Clay builds it against your real data, in seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Real data</span>
            <span>No configuration</span>
            <span>Full history</span>
            <span>Works with your team</span>
          </div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            {/* Plain <a>, not next/link: these are the first-ever navigation
                into Clerk's UI for a fresh browser session, which needs a full
                page load to complete Clerk's dev-instance handshake redirect.
                A client-side soft nav can skip that and hang until a refresh. */}
            <Button asChild size="lg">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/sign-up" className="group">
                Sign Up / Sign In
                <ArrowRight
                  data-icon="inline-end"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/demo" className="group">
                <CirclePlay data-icon="inline-start" />
                Try It — No Account
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Demo feed — a generated view, presented like a post */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <span className="flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <MessageSquareText className="size-3.5" />
              How It Works
            </span>
            <h2
              className={`${fraunces.className} text-3xl font-medium tracking-tight text-balance sm:text-4xl`}
            >
              One request in, one working view out.
            </h2>
            <p className="text-muted-foreground">
              These aren&apos;t screenshots of a designer&apos;s mockup — they&apos;re
              what a session in Clay actually produces.
            </p>
          </div>

          <div className="mt-14 grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">
                01 — ASK
              </p>
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Type a sentence, get a dashboard.
              </h3>
              <p className="leading-relaxed text-muted-foreground">
                The card on the right is a view the agent produced from the single
                request at its top. It picked the chart, bound it to an approved
                query over the Website Relaunch project&apos;s real tasks, and
                rendered the result — no chart picker, no field mapping, no
                configuration screen.
              </p>
              <p className="text-sm text-muted-foreground">
                The <span className="font-medium text-foreground">live view</span>{" "}
                badge means exactly that: when a task changes status, the bars change
                with it.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Today · 4:12 PM</span>
              <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--status-in-progress),transparent_85%)] px-2 py-0.5 text-[10px] font-medium text-(--status-in-progress)">
                <span className="size-1.5 rounded-full bg-current" />
                live view
              </span>
            </div>
            <p className="mt-2 font-semibold">
              &ldquo;Show tasks by status as a bar chart.&rdquo;
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              One sentence in chat. The agent assembled this view and wired it to
              the Website Relaunch project.
            </p>
            <div className="mt-4 space-y-3 rounded-lg bg-muted/50 p-4">
              <div className="flex h-24 items-end gap-2.5">
                {[
                  { h: "45%", c: "var(--status-todo)", value: 6 },
                  { h: "85%", c: "var(--status-in-progress)", value: 11 },
                  { h: "60%", c: "var(--status-in-review)", value: 8 },
                  { h: "100%", c: "var(--status-done)", value: 13 },
                ].map((bar, i) => (
                  <div
                    key={i}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
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
                {["Todo", "In Progress", "In Review", "Done"].map((label) => (
                  <span
                    key={label}
                    className="flex-1 truncate text-center text-[9px] text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-primary">
              <span>#website-relaunch</span>
              <span>#generated</span>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-accent">
                <MessageSquareText className="size-3 text-accent-foreground" />
              </span>
              <span>
                <span className="font-medium text-foreground">Agent</span> · Built from
                live tasks. Ask again to change anything.
              </span>
            </div>
          </div>
          </div>

          <div className="mt-16 grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-4 lg:order-2">
              <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">
                02 — REFINE
              </p>
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Keep talking until it&apos;s right.
              </h3>
              <p className="leading-relaxed text-muted-foreground">
                This card is that same view&apos;s history. Each follow-up request —
                a bigger chart, colors by status — became a new numbered version
                instead of an overwrite, so you can step back to any point or branch
                off in a new direction.
              </p>
              <p className="text-sm text-muted-foreground">
                The unchecked line isn&apos;t a task — it&apos;s simply the next
                request that hasn&apos;t been asked yet.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:order-1 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Today · 4:18 PM</span>
              <span className="text-xs text-muted-foreground">v3</span>
            </div>
            <p className="mt-2 font-semibold">Refined in conversation.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every request becomes a new version. Nothing is overwritten.
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                  <Check className="size-3" />
                </span>
                <span className="line-through">&ldquo;Make the chart bigger&rdquo; — v2</span>
              </li>
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                  <Check className="size-3" />
                </span>
                <span className="line-through">&ldquo;Color the bars by status&rdquo; — v3</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Circle className="size-5 text-muted-foreground/50" strokeWidth={1.5} />
                <span>&ldquo;Add a done-this-week tile&rdquo;</span>
              </li>
            </ul>
          </div>
          </div>
        </div>
      </section>

      {/* Statement */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <h2
            className={`${fraunces.className} text-4xl leading-[1.08] font-medium tracking-tight sm:text-6xl`}
          >
            Not a form builder.
            <br />
            Not another dashboard.
          </h2>
          <p className="text-lg text-muted-foreground sm:text-xl">
            Just a tracker for projects and tasks — with an agent that assembles
            whatever interface you ask it for, out of parts that were checked
            before it got to use them.
          </p>
        </div>
        <div className="mt-16 grid border-t border-border sm:grid-cols-3">
          {[
            {
              n: "01",
              title: "Ask. Watch. Ship.",
              body: "No drag-and-drop builder, no widget library, no settings maze. Type a sentence and the view exists.",
            },
            {
              n: "02",
              title: "Real data. Real team.",
              body: "Every view queries the same live database that holds your projects and tasks — shared with whoever you invite.",
            },
            {
              n: "03",
              title: "Yours to rewind.",
              body: "Each refinement is a new version. Step back through every iteration a view has ever had.",
            },
          ].map((col, i) => (
            <div
              key={col.n}
              className={`space-y-3 py-8 sm:pr-8 ${
                i > 0 ? "border-t border-border sm:border-t-0 sm:border-l sm:pl-8" : ""
              }`}
            >
              <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">
                {col.n}
              </p>
              <h3 className="text-lg font-semibold">{col.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{col.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product */}
      <section id="features" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="space-y-5 self-start lg:sticky lg:top-28">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Star className="size-3.5" />
              Product
            </span>
            <h2
              className={`${fraunces.className} text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl`}
            >
              Small on purpose. Live by default.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Clay keeps the core loop simple: track your work, ask for the view you
              need, and keep every version on your side of the line.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/sign-up"
              className="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary"
            >
              Try It Yourself <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "Ask, Don't Configure",
                body: "Describe a dashboard in plain language and it exists seconds later — no chart picker, no field mapping, no settings maze.",
              },
              {
                icon: MessageSquareText,
                title: "Refine in Conversation",
                body: "“Make it bigger.” “Group by assignee.” The agent remembers the thread, so follow-ups build on each other.",
              },
              {
                icon: History,
                title: "Versioned by Default",
                body: "Every change is a new version, never an overwrite. Roll back to any point, with a real diff of what moved.",
              },
              {
                icon: ShieldCheck,
                title: "Guardrailed by Construction",
                body: "The agent never writes code or SQL. It picks validated widgets and binds them to approved queries — so a generated view is safe the moment it appears.",
              },
              {
                icon: Users,
                title: "Built for a Team",
                body: "Invite people into a shared workspace, assign work, comment on tasks. Every view, chart and audit entry is scoped to it.",
              },
              {
                icon: Plug,
                title: "Connect Your Assistant",
                body: "Clay speaks MCP. Point Claude Desktop at it and ask about your projects from anywhere — read-only, one workspace, revocable.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <card.icon className="size-4.5 text-muted-foreground" />
                <h3 className="text-[15px] leading-snug font-semibold">{card.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deploy */}
      <section id="deploy" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="space-y-5 self-start lg:sticky lg:top-28">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Rocket className="size-3.5" />
              Deploy
            </span>
            <h2
              className={`${fraunces.className} text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl`}
            >
              Run it, then ask.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              A Docker Postgres and one dev command get a private Clay workspace
              running on your machine in minutes.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary"
            >
              View the Repository <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="self-start overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2.5 px-5 pt-5">
              <Terminal className="size-4.5 text-muted-foreground" />
              <span className="font-semibold">Local setup</span>
            </div>
            <p className="px-5 pt-2 pb-4 text-sm text-muted-foreground">
              Three commands to start your Clay server
            </p>
            <div className="bg-foreground px-5 py-5 font-mono text-sm leading-7 text-background">
              <p>docker compose up -d</p>
              <p>npm install</p>
              <p>npm run dev</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="space-y-5 self-start lg:sticky lg:top-28">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Lightbulb className="size-3.5" />
              Use Cases
            </span>
            <h2
              className={`${fraunces.className} text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl`}
            >
              Where Clay fits.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Use it wherever the view you need keeps changing faster than anyone
              wants to configure it.
            </p>
          </div>
          <div className="self-start border-t border-border">
            {[
              {
                n: "01",
                icon: Wrench,
                who: "Solo builders",
                what: "Side-project boards & burndowns",
              },
              {
                n: "02",
                icon: Users,
                who: "Small teams",
                what: "Sprint status & standup views",
              },
              {
                n: "03",
                icon: Code,
                who: "Engineering leads",
                what: "Cross-project rollups",
              },
              {
                n: "04",
                icon: DollarSign,
                who: "Freelancers",
                what: "Per-client trackers",
              },
              {
                n: "05",
                icon: MessageSquareText,
                who: "Product managers",
                what: "Status reports on demand",
              },
              {
                n: "06",
                icon: GitBranch,
                who: "Tinkerers",
                what: "Ad-hoc questions of live data",
              },
            ].map((row) => (
              <div
                key={row.n}
                className="grid grid-cols-[3.5rem_1fr] items-center gap-2 border-b border-border py-5 sm:grid-cols-[5rem_11rem_1fr]"
              >
                <span className="flex items-center gap-2.5 text-xs tracking-widest text-muted-foreground">
                  {row.n}
                  <row.icon className="size-3.5" />
                </span>
                <span className="font-semibold">{row.who}</span>
                <span className="col-span-2 pl-14 text-sm text-muted-foreground sm:col-span-1 sm:pl-0">
                  {row.what}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="space-y-5 self-start lg:sticky lg:top-28">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <BookOpen className="size-3.5" />
              Resources
            </span>
            <h2
              className={`${fraunces.className} text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl`}
            >
              Choose your next step.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Create a workspace, read the code, or run Clay locally and see how the
              agent is built.
            </p>
          </div>
          <div className="self-start">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-up" className="group block border-b border-border pb-8">
              <span className="flex items-center justify-between text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                <span className="flex items-center gap-2">
                  <Sparkles className="size-3.5" />
                  Start
                </span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
              <h3
                className={`${fraunces.className} mt-4 text-3xl font-medium tracking-tight transition-colors group-hover:text-primary`}
              >
                Ask for your first view
              </h3>
              <p className="mt-2 text-muted-foreground">
                Create an account, add a project, and describe the dashboard you want.
              </p>
            </a>
            {[
              {
                label: "Source",
                icon: Code,
                title: "Read the code",
                body: "The full app — agent loop, tools, and UI — is on GitHub.",
                href: REPO_URL,
                external: true,
              },
              {
                label: "Deploy",
                icon: Rocket,
                title: "Run it locally",
                body: "Postgres via Docker, then one command for the dev server.",
                href: "#deploy",
                external: false,
              },
              {
                label: "Trust",
                icon: ShieldCheck,
                title: "See the guardrails",
                body: "Read-only agent tools, rate limits, and a full audit trail.",
                href: "#features",
                external: false,
              },
            ].map((row) => (
              <a
                key={row.title}
                href={row.href}
                {...(row.external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="group grid grid-cols-[8rem_1fr_2rem] items-center gap-4 border-b border-border py-6"
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                  <row.icon className="size-3.5" />
                  {row.label}
                </span>
                <span>
                  <span className="block font-semibold transition-colors group-hover:text-primary">
                    {row.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {row.body}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="space-y-5 self-start lg:sticky lg:top-28">
            <h2
              className={`${fraunces.className} text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl`}
            >
              Common questions.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              What Clay is, what the agent can touch, and what happens to your views
              over time.
            </p>
          </div>
          <div className="self-start">
            {[
              {
                q: "What does the agent actually build?",
                a: "Real interfaces — charts, tables, boards and tiles — rendered inside Clay against your live project data. It does not write code. It picks from a validated vocabulary of widgets and binds each one to an approved query, which is why a generated view can be trusted the moment it appears rather than reviewed first.",
              },
              {
                q: "Can the agent change or delete my data?",
                a: "No. It works through a small set of vetted, read-only tools: describe the data model, run an approved query, propose a view. Writing isn't one of its abilities. A view can still contain controls that change things — a status dropdown on a table row — but those only ever run when you click them, under your own account, never the agent's.",
              },
              {
                q: "Can I try it without signing up?",
                a: "Yes, and it isn't a read-only tour. The demo hands you a real workspace pre-filled with six projects and a team — you can create tasks, drag dashboards around, import a spreadsheet and export a workbook. It's the same application a paying customer uses; it just gets deleted after 24 hours.",
              },
              {
                q: "Can I get my existing work in?",
                a: "Import a CSV or an Excel file. Columns are matched automatically where the header is recognisable, statuses and priorities are translated from however your spreadsheet words them, and a dry run tells you exactly what will be created — and which rows need attention — before anything is written.",
              },
              {
                q: "Does it work with my team?",
                a: "Invite people into a shared workspace and everything is scoped to it: assignees, comments, workload charts, the audit log. Owners keep the actions that reshape a workspace, like deleting a project.",
              },
              {
                q: "What is Clay built with?",
                a: "Next.js and React on the front, tRPC and Drizzle over Postgres on the back, Clerk for auth, and the Claude API driving the agent loop. Around 250 tests, including a suite that tries to make the agent misbehave and a graded set that checks the views it builds are actually good. The source is on GitHub.",
              },
            ].map((item, i) => (
              <div
                key={item.q}
                className={`space-y-3 py-6 ${i > 0 ? "border-t border-border" : "pt-0"}`}
              >
                <h3 className="font-semibold">{item.q}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
          <span className="text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase">
            Start Here
          </span>
          <h2
            className={`${fraunces.className} text-4xl font-medium tracking-tight text-balance sm:text-6xl`}
          >
            Start with one question.
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/sign-up">Sign Up / Sign In</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/demo">
                <CirclePlay data-icon="inline-start" />
                Try Live Demo
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="#features">See Features</a>
            </Button>
            <Button asChild variant="outline">
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                View Source
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          {[
            {
              heading: "Explore",
              links: [
                { label: "Features", href: "#features" },
                { label: "Deploy", href: "#deploy" },
                { label: "Use Cases", href: "#use-cases" },
                { label: "FAQ", href: "#faq" },
              ],
            },
            {
              heading: "App",
              links: [
                { label: "Dashboard", href: "/dashboard" },
                { label: "Chat", href: "/chat" },
                { label: "Views", href: "/views" },
                { label: "Audit Log", href: "/audit" },
              ],
            },
            {
              heading: "Account",
              links: [
                { label: "Sign In", href: "/sign-in" },
                { label: "Create Account", href: "/sign-up" },
              ],
            },
            {
              heading: "Community",
              links: [
                { label: "GitHub", href: REPO_URL, external: true },
                { label: "Report an Issue", href: `${REPO_URL}/issues`, external: true },
              ],
            },
          ].map((col) => (
            <div key={col.heading} className="space-y-4">
              <p className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                {col.heading}
              </p>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...("external" in link && link.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:px-8">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="" width={20} height={20} className="size-5" />
              <span>Clay — a tracker that builds its own interface.</span>
            </div>
            <span>© {new Date().getFullYear()} Clay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
