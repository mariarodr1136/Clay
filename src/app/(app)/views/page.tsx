"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlignLeft,
  BarChart3,
  BookmarkPlus,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const widgetMeta: Record<string, { icon: typeof BarChart3; label: string }> = {
  chart: { icon: BarChart3, label: "chart" },
  kpi: { icon: Gauge, label: "KPI" },
  computedField: { icon: Gauge, label: "KPI" },
  table: { icon: Table2, label: "table" },
  filterBar: { icon: SlidersHorizontal, label: "filter" },
  text: { icon: AlignLeft, label: "note" },
  progress: { icon: ListChecks, label: "meter" },
  form: { icon: ListChecks, label: "form" },
};

function WidgetSummary({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([type]) => widgetMeta[type]);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([type, count]) => {
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

function TemplatesSection() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const templatesQuery = trpc.views.listTemplates.useQuery();

  const createFrom = trpc.views.createFromTemplate.useMutation({
    onSuccess: ({ view }) => {
      toast.success(`Created "${view.name}" from template`);
      utils.views.list.invalidate();
      router.push(`/views/${view.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTemplate = trpc.views.deleteTemplate.useMutation({
    onSuccess: () => utils.views.listTemplates.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  if (!templatesQuery.data || templatesQuery.data.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Templates
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templatesQuery.data.map((template) => (
          <Card key={template.id} className="gap-3">
            <CardContent className="flex h-full flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                  <BookmarkPlus className="text-muted-foreground size-4" />
                  {template.name}
                </h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete template"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive -mt-1"
                  onClick={() => deleteTemplate.mutate({ templateId: template.id })}
                >
                  <Trash2 />
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Saved {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-auto self-start"
                disabled={createFrom.isPending}
                onClick={() => createFrom.mutate({ templateId: template.id })}
              >
                {createFrom.isPending ? "Creating…" : "Use template"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function ViewsPage() {
  const viewsQuery = trpc.views.list.useQuery();
  const views = viewsQuery.data ?? [];
  const orgViews = views.filter((v) => v.scope === "org");
  const personalViews = views.filter((v) => v.scope !== "org");

  const renderCard = (view: (typeof views)[number]) => (
    <Link key={view.id} href={`/views/${view.id}`} className="group">
      <Card className="h-full gap-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-14px_rgba(0,0,0,0.14)]">
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold tracking-tight">{view.name}</h2>
            <Badge variant={view.scope === "org" ? "default" : "outline"} className="shrink-0">
              {view.scope === "org" ? "org" : "personal"}
            </Badge>
          </div>
          {view.promptText && (
            <p className="text-muted-foreground flex items-start gap-1.5 text-sm leading-relaxed">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2 italic">&ldquo;{view.promptText}&rdquo;</span>
            </p>
          )}
          <div className="mt-auto space-y-3">
            <WidgetSummary counts={view.widgetCounts} />
            <p className="text-muted-foreground text-xs">
              v{view.versionCount} · updated{" "}
              {formatDistanceToNow(new Date(view.updatedAt), { addSuffix: true })}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Views</h1>
        <p className="text-muted-foreground text-sm">
          Dashboards generated from conversation — saved, versioned, and live against your data.
        </p>
      </div>

      {viewsQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {viewsQuery.data && views.length === 0 && (
        <div className="border-border flex flex-col items-center gap-4 rounded-3xl border border-dashed py-16 text-center">
          <div className="bg-muted flex size-11 items-center justify-center rounded-full">
            <LayoutDashboard className="text-muted-foreground size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No views yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
              Describe the dashboard you want in Chat — &ldquo;show overdue work by owner&rdquo;,
              &ldquo;status breakdown per project&rdquo; — and the agent builds it here.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/chat">
              <MessageSquareText data-icon="inline-start" />
              Ask for your first view
            </Link>
          </Button>
        </div>
      )}

      {orgViews.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Published to the org
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{orgViews.map(renderCard)}</div>
        </section>
      )}

      {personalViews.length > 0 && (
        <section className="space-y-3">
          {orgViews.length > 0 && (
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Personal
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personalViews.map(renderCard)}
          </div>
        </section>
      )}

      <TemplatesSection />
    </div>
  );
}
