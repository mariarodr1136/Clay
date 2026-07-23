"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium">Something went wrong loading this page.</p>
      <p className="text-muted-foreground max-w-sm text-sm">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
