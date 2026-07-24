import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoNav } from "@/components/demo/demo-nav";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/demo" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
              <span className="text-[15px] font-semibold tracking-tight">Clay</span>
              <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                <Sparkles className="size-3" />
                Demo mode
              </span>
            </Link>
            <DemoNav />
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

      <main className="flex-1 px-6 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-3.5 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              You&apos;re exploring a fully loaded sample workspace, read-only. No account needed —
              nothing you click is saved.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/sign-up" className="shrink-0">
              <Button size="sm" variant="outline">
                Create your own workspace
              </Button>
            </a>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
