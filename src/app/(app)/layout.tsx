import Link from "next/link";
import { eq } from "drizzle-orm";
import { UserButton } from "@clerk/nextjs";
import { ensureUserOrg } from "@/server/auth/ensure-user-org";
import { db } from "@/server/db/client";
import { organizations } from "@/server/db/schema";

const navItems = [
  { href: "/dashboard", label: "Projects" },
  { href: "/views", label: "Views" },
  { href: "/chat", label: "Chat" },
  { href: "/audit", label: "Audit" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await ensureUserOrg();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="text-[15px] font-semibold tracking-tight">SelfSoftware</span>
              {org && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {org.name}
                </span>
              )}
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="flex-1 px-6 py-10 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
