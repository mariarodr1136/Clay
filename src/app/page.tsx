import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Real data, not a demo",
    body: "Every view is built against your actual projects and tasks — never a mockup.",
  },
  {
    title: "Ask, don't configure",
    body: "Describe the dashboard you want in plain language and watch it appear.",
  },
  {
    title: "Refine in conversation",
    body: "“Make this chart bigger.” Every change is a new version — nothing is ever lost.",
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
        <div className="aspect-[3/1] w-[80rem] bg-gradient-to-tr from-[oklch(0.87_0.08_250)] via-[oklch(0.93_0.05_310)] to-[oklch(0.9_0.07_190)] opacity-40" />
      </div>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center sm:py-32">
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

      <section className="mx-auto grid w-full max-w-4xl gap-4 px-6 pb-24 sm:grid-cols-3 sm:pb-32">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]"
          >
            <h2 className="text-sm font-semibold">{feature.title}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
