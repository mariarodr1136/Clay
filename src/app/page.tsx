import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">SelfSoftware</h1>
      <p className="text-muted-foreground max-w-md">
        Dynamic software interfaces — ask your interface into existence.
      </p>
      <div className="flex gap-3">
        {/* Plain <a>, not next/link: these are the first-ever navigation
            into Clerk's UI for a fresh browser session, which needs a full
            page load to complete Clerk's dev-instance handshake redirect.
            A client-side soft nav can skip that and hang until a refresh. */}
        <Button asChild>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/sign-up">Sign up</a>
        </Button>
        <Button asChild variant="outline">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/sign-in">Sign in</a>
        </Button>
      </div>
    </div>
  );
}
