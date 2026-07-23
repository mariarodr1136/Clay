import Link from "next/link";
import { eq } from "drizzle-orm";
import { UserButton } from "@clerk/nextjs";
import { ensureUserOrg } from "@/server/auth/ensure-user-org";
import { db } from "@/server/db/client";
import { organizations } from "@/server/db/schema";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await ensureUserOrg();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                S
              </span>
              <span className="text-[15px] font-semibold tracking-tight">Clay</span>
              {org && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {org.name}
                </span>
              )}
            </Link>
            <AppNav />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="flex-1 px-6 py-10 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
