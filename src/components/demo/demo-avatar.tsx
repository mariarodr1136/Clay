import type { DemoPerson } from "@/fixtures/demo-data";
import { cn } from "@/lib/utils";

export function DemoAvatar({
  person,
  size = "sm",
  className,
}: {
  person: DemoPerson;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={person.name}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
        className
      )}
      style={{
        color: `var(${person.colorVar})`,
        backgroundColor: `color-mix(in oklch, var(${person.colorVar}), transparent 86%)`,
      }}
    >
      {person.initials}
    </span>
  );
}
