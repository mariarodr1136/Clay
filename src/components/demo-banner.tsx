import { Sparkles } from "lucide-react";
import { LeaveDemoButton } from "@/components/leave-demo-button";

// Shown across the top of every page for a guest. The workspace is genuinely
// real — writes land, exports work, the agent builds views over it — so the
// only thing separating it from an account is that it gets swept, and that's
// the one fact the banner has to carry.
export function DemoBanner() {
  return (
    <div className="border-b border-black/[0.06] bg-accent/60 dark:border-white/[0.08]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-2 sm:px-8">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="size-3.5" />
          Demo workspace
        </span>
        <span className="text-muted-foreground text-xs">
          Everything here works for real — but it&apos;s deleted after 24 hours.
        </span>
        <LeaveDemoButton label="Keep this — create an account" className="ml-auto h-7 text-xs" />
      </div>
    </div>
  );
}
