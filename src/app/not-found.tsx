import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

// The root not-found also serves every URL that matches no route at all, so
// this is what a mistyped link gets — previously Next's unstyled default,
// which reads like the site is broken rather than like the address is wrong.
//
// /dashboard rather than / for the second action: someone who lands here from
// a bad in-app link wants to be back in the app, and a signed-out visitor is
// bounced to sign-in by the middleware anyway.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <Image src="/logo.png" alt="" width={36} height={36} className="size-9" />
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold">This page doesn&apos;t exist</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The link may be out of date, or the view it pointed to may have been deleted.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Go to your projects</Link>
        </Button>
      </div>
    </main>
  );
}
