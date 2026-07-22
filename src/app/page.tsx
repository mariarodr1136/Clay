import Link from "next/link";
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
        <Button asChild>
          <Link href="/sign-up">Sign up</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
