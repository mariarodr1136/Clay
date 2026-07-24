import Link from "next/link";
import {
  AlignLeft,
  BarChart3,
  Gauge,
  ListChecks,
  SlidersHorizontal,
  Sparkles,
  Table2,
} from "lucide-react";
import { demoViewDefs, type DemoWidget } from "@/fixtures/demo-dashboards";
import { demoPerson } from "@/fixtures/demo-data";
import { DemoAvatar } from "@/components/demo/demo-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const widgetMeta: Record<DemoWidget["type"], { icon: typeof BarChart3; label: string }> = {
  chart: { icon: BarChart3, label: "chart" },
  kpi: { icon: Gauge, label: "KPI" },
  table: { icon: Table2, label: "table" },
  filterBar: { icon: SlidersHorizontal, label: "filter" },
  text: { icon: AlignLeft, label: "note" },
  progress: { icon: ListChecks, label: "meter" },
};

function WidgetSummary({ widgets }: { widgets: DemoWidget[] }) {
  const counts = new Map<DemoWidget["type"], number>();
  for (const w of widgets) counts.set(w.type, (counts.get(w.type) ?? 0) + 1);
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...counts.entries()].map(([type, count]) => {
        const meta = widgetMeta[type];
        return (
          <span
            key={type}
            className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          >
            <meta.icon className="size-3" />
            {count} {meta.label}
            {count > 1 && "s"}
          </span>
        );
      })}
    </div>
  );
}

export default function DemoViewsPage() {
  const orgViews = demoViewDefs.filter((v) => v.scope === "org");
  const personalViews = demoViewDefs.filter((v) => v.scope === "personal");

  const renderCard = (view: (typeof demoViewDefs)[number]) => {
    const creator = demoPerson(view.creatorId);
    return (
      <Link key={view.id} href={`/demo/views/${view.id}`} className="group">
        <Card className="h-full gap-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-14px_rgba(0,0,0,0.14)]">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold tracking-tight">{view.name}</h2>
              <Badge variant={view.scope === "org" ? "default" : "outline"} className="shrink-0">
                {view.scope === "org" ? "org" : "personal"}
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-start gap-1.5 text-sm leading-relaxed">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2 italic">&ldquo;{view.prompt}&rdquo;</span>
            </p>
            <div className="mt-auto space-y-3">
              <WidgetSummary widgets={view.widgets} />
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <DemoAvatar person={creator} />
                <span>{creator.name.split(" ")[0]}</span>
                <span className="ml-auto">
                  v{view.version} · {view.updatedLabel}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Views</h1>
        <p className="text-muted-foreground text-sm">
          {demoViewDefs.length} dashboards generated from conversation — saved, versioned, and live
          against workspace data.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Published to the org
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{orgViews.map(renderCard)}</div>
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Personal
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personalViews.map(renderCard)}
        </div>
      </section>
    </>
  );
}
