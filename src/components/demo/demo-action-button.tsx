"use client";

import type { ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Every mutating action in the demo renders this instead of a real trigger —
// same visual weight as the live app, but confirms nothing is actually
// writable and points at sign-up instead.
export function DemoActionButton({
  message = "Sign up to save changes — nothing here is writable.",
  children,
  ...props
}: ComponentProps<typeof Button> & { message?: string }) {
  return (
    <Button {...props} onClick={() => toast.info(message)}>
      {children}
    </Button>
  );
}
