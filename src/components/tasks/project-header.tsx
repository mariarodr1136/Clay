"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; imageUrl: string | null };

// Initials rather than photos: most workspaces have no avatars set, and a
// row of identical placeholder silhouettes says less than initials do.
function Avatar({ person, className }: { person: Person; className?: string }) {
  const initials = person.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  // Stable per person, so the same face keeps the same colour everywhere.
  const hue = [...person.id].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <span
      title={person.name}
      className={cn(
        "ring-background flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2",
        className
      )}
      style={{
        backgroundColor: `oklch(0.9 0.06 ${hue})`,
        color: `oklch(0.35 0.09 ${hue})`,
      }}
    >
      {initials || "?"}
    </span>
  );
}

export function ProjectHeader({
  lead,
  members,
  targetDate,
  openPoints,
  overdue,
}: {
  lead: Person | null;
  members: Person[];
  targetDate: string | null;
  openPoints: number;
  overdue: number;
}) {
  // Nothing to say if the project has no lead, no team, and no deadline —
  // better an absent row than a row of dashes.
  if (!lead && members.length === 0 && !targetDate && openPoints === 0 && overdue === 0) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {lead && (
        <span className="flex items-center gap-2">
          <Avatar person={lead} />
          Led by <span className="text-foreground font-medium">{lead.name}</span>
        </span>
      )}

      {members.length > 0 && (
        <span className="flex items-center gap-2">
          <span className="flex -space-x-1.5">
            {members.slice(0, 5).map((member) => (
              <Avatar key={member.id} person={member} />
            ))}
          </span>
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      )}

      {targetDate && (
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          Target {format(parseISO(targetDate), "MMM d")}
        </span>
      )}

      {openPoints > 0 && (
        <span>
          <span className="text-foreground font-medium">{openPoints}</span> pts open
        </span>
      )}

      {overdue > 0 && (
        <span className="text-destructive font-medium">{overdue} overdue</span>
      )}
    </div>
  );
}
