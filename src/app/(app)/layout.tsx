import Link from "next/link";
import { eq } from "drizzle-orm";
import { UserButton } from "@clerk/nextjs";
import { ensureUserOrg } from "@/server/auth/ensure-user-org";
import { db } from "@/server/db/client";
import { organizations } from "@/server/db/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await ensureUserOrg();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">
            SelfSoftware{org ? ` · ${org.name}` : ""}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <Link href="/views" className="text-muted-foreground hover:text-foreground">
              Views
            </Link>
          </nav>
        </div>
        <UserButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
