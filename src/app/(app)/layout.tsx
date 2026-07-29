import Link from "next/link";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { resolveActiveOrg } from "@/server/auth/resolve-org";
import { db } from "@/server/db/client";
import { organizations } from "@/server/db/schema";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { AppClerkProvider } from "@/components/clerk-provider";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { CommandPalette } from "@/components/command-palette";
import { SafeBoundary } from "@/components/safe-boundary";
import { DemoBanner } from "@/components/demo-banner";
import { LeaveDemoButton } from "@/components/leave-demo-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { organizationId, isGuest } = await resolveActiveOrg();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  const shell = (
    <div className="flex min-h-screen flex-col">
      {isGuest && <DemoBanner />}
      <header className="print-hidden sticky top-0 z-40 border-b border-black/[0.06] bg-background/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
              <span className="text-[15px] font-semibold tracking-tight">Clay</span>
            </Link>
            {isGuest ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {org?.name ?? "Demo Workspace"}
              </span>
            ) : (
              // Switching org here changes what every org-scoped query
              // returns, and it's also where members get invited. Boundaried
              // because it depends on a Clerk feature that has to be enabled
              // per instance — a production instance without it must lose the
              // switcher, not the app.
              <SafeBoundary
                label="workspace-switcher"
                fallback={
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {org?.name ?? "Workspace"}
                  </span>
                }
              >
                <WorkspaceSwitcher fallbackName={org?.name ?? "Workspace"} />
              </SafeBoundary>
            )}
            <AppNav />
          </div>
          <div className="flex items-center gap-2">
            <CommandPalette />
            <ThemeToggle />
            {isGuest ? <LeaveDemoButton label="Sign up" /> : <UserMenu />}
          </div>
        </div>
      </header>
      <main className="flex-1 px-6 py-10 sm:px-8 sm:py-12">{children}</main>
    </div>
  );

  // Guests have no Clerk session, so Clerk's own components (the user menu,
  // the organization switcher) have nothing to render and the provider has
  // no reason to load. Everything else on the page is identical — this is
  // the product, not a demo build of it.
  return isGuest ? shell : <AppClerkProvider>{shell}</AppClerkProvider>;
}
