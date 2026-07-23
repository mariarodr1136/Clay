"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Clerk's <UserButton/> falls back to an auto-generated, colorful gradient
// avatar for users without a photo. We want a flat brand-blue circle with a
// plain person icon instead, which Clerk's appearance API can't express
// (the fallback is a real image, not a themeable element) — so this drives
// the same account menu (manage account / sign out) off a custom trigger.
export function UserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();

  if (!isLoaded) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {user?.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Clerk-hosted URL, not in next/image's remote patterns
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "Account"}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-primary">
            <UserIcon className="size-4 text-primary-foreground" />
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => openUserProfile()}>Manage account</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => signOut({ redirectUrl: "/" })}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
