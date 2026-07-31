import Link from "next/link";
import { Button } from "@/components/ui/button";

export { noIndex as metadata } from "@/lib/no-index";

// Shown when the per-IP rate limit on demo workspace creation trips. Each
// visit provisions a real tenant, so this is what stops one network from
// filling the database.
export default function DemoBusyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold">The demo is busy right now</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        A lot of demo workspaces have been created from this network in the last few minutes. Give
        it a moment and try again — or create a free account, which skips the queue entirely.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/demo">Try again</Link>
        </Button>
        <Button asChild>
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </div>
    </main>
  );
}
