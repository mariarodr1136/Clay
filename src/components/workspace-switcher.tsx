"use client";

import { OrganizationSwitcher, useAuth } from "@clerk/nextjs";

// Clerk owns the whole membership lifecycle — creating an organization,
// inviting people by email, accepting invitations, changing roles — so the
// switcher is mounted rather than reimplemented. What Clay adds is the
// mapping from "active Clerk organization" to an organizations row, which
// resolveActiveOrg does on the server for every request.
//
// A user with no active organization is in their private workspace; the
// switcher still renders so they can create or join one, but the chip shows
// the personal workspace name rather than Clerk's empty state.
export function WorkspaceSwitcher({ fallbackName }: { fallbackName: string }) {
  const { orgId, isLoaded } = useAuth();

  return (
    <div className="flex items-center gap-2">
      {isLoaded && !orgId && (
        <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
          {fallbackName}
        </span>
      )}
      <OrganizationSwitcher
        hidePersonal={false}
        afterCreateOrganizationUrl="/dashboard"
        afterSelectOrganizationUrl="/dashboard"
        afterSelectPersonalUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: "flex items-center",
            organizationSwitcherTrigger:
              "rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted",
          },
        }}
      />
    </div>
  );
}
