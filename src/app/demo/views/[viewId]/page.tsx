"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, History, Sparkles } from "lucide-react";
import { auditActionMeta, demoAuditLog, demoViewById } from "@/fixtures/demo-dashboards";
import { demoPerson } from "@/fixtures/demo-data";
import { DemoViewRenderer } from "@/components/demo/demo-view-renderer";
import { DemoActionButton } from "@/components/demo/demo-action-button";
import { DemoRefinePanel } from "@/components/demo/demo-refine-panel";
import { DemoAvatar } from "@/components/demo/demo-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DemoViewPage() {
  const params = useParams<{ viewId: string }>();
  const view = demoViewById(params.viewId);

  if (!view) {
    return (
      <p className="text-muted-foreground text-sm">
        View not found.{" "}
        <Link href="/demo/views" className="text-foreground font-medium hover:underline">
          Back to views
        </Link>
      </p>
    );
  }

  const creator = demoPerson(view.creatorId);
  const history = demoAuditLog.filter((e) => e.viewId === view.id);

  return (
    <>
      <div className="space-y-3">
        <Link
          href="/demo/views"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft className="size-3.5" />
          Views
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="flex flex-wrap items-center gap-2.5 text-3xl font-semibold tracking-tight">
              {view.name}
              <Badge variant={view.scope === "org" ? "default" : "outline"}>
                {view.scope === "org" ? "org" : "personal"}
              </Badge>
              <Badge variant="outline">v{view.version}</Badge>
            </h1>
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm italic">
              <Sparkles className="size-3.5 shrink-0" />
              &ldquo;{view.prompt}&rdquo;
            </p>
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <DemoAvatar person={creator} />
              Created by {creator.name} · updated {view.updatedLabel}
            </p>
          </div>
          <DemoActionButton
            size="sm"
            variant="outline"
            message={
              view.scope === "org"
                ? "Sign up to manage published views."
                : "Sign up to publish views to your org."
            }
          >
            {view.scope === "org" ? "Manage sharing" : "Publish to org"}
          </DemoActionButton>
        </div>
      </div>

      <DemoViewRenderer view={view} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DemoRefinePanel />
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="text-muted-foreground size-4" />
              Version history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 && (
              <p className="text-muted-foreground text-sm">No recorded changes.</p>
            )}
            <ul className="space-y-3">
              {history.map((entry) => {
                const meta = auditActionMeta[entry.action];
                return (
                  <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(${meta.colorVar})` }}
                    />
                    <div className="min-w-0">
                      <p>
                        <span className="font-medium">{meta.label}</span>
                        {entry.version != null && (
                          <span className="text-muted-foreground"> · v{entry.version}</span>
                        )}
                        <span className="text-muted-foreground"> · {entry.timeLabel}</span>
                      </p>
                      {entry.prompt && (
                        <p className="text-muted-foreground truncate text-xs italic">
                          &ldquo;{entry.prompt}&rdquo;
                        </p>
                      )}
                      {entry.detail && (
                        <p className="text-muted-foreground text-xs">{entry.detail}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground mt-4 border-t pt-3 text-xs">
              Every version is kept — the full trail is in the{" "}
              <Link href="/demo/audit" className="text-foreground font-medium hover:underline">
                audit log
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
