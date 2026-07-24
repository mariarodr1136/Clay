import { healthMeta, type DemoProjectHealth } from "@/fixtures/demo-data";

export function DemoHealthChip({ health }: { health: DemoProjectHealth }) {
  const meta = healthMeta[health];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{
        color: `var(${meta.colorVar})`,
        backgroundColor: `color-mix(in oklch, var(${meta.colorVar}), transparent 88%)`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: `var(${meta.colorVar})` }}
      />
      {meta.label}
    </span>
  );
}
