"use client";

import type { DemoWidget } from "@/fixtures/demo-dashboards";
import { runDemoQuery } from "@/fixtures/demo-data";
import { MeterList } from "@/components/charts/meter-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProgressWidget = Extract<DemoWidget, { type: "progress" }>;

export function DemoProgressWidget({
  widget,
  filters,
}: {
  widget: ProgressWidget;
  filters: Record<string, string>;
}) {
  const rows = runDemoQuery(widget.query.queryId, widget.query.params ?? {}, filters);

  return (
    <Card className="h-full gap-3 overflow-auto">
      {widget.title && (
        <CardHeader>
          <CardTitle className="text-sm">{widget.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <MeterList rows={rows} nameField={widget.config.nameField} valueField={widget.config.valueField} />
      </CardContent>
    </Card>
  );
}
