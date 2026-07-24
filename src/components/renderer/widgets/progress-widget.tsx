"use client";

import type { z } from "zod";
import type { progressWidgetSchema } from "@/lib/dsl/schema";
import { useCatalogQuery } from "../use-catalog-query";
import { MeterList } from "@/components/charts/meter-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProgressWidget({
  widget,
  filters,
}: {
  widget: z.infer<typeof progressWidgetSchema>;
  filters: Record<string, string>;
}) {
  const query = useCatalogQuery(widget.dataBinding, filters);
  const rows = (query.data ?? []) as Record<string, unknown>[];

  return (
    <Card className="h-full gap-3 overflow-auto">
      {widget.title && (
        <CardHeader>
          <CardTitle className="text-sm">{widget.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {query.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {query.error && <p className="text-destructive text-sm">{query.error.message}</p>}
        {query.data && rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No data.</p>
        )}
        {query.data && rows.length > 0 && (
          <MeterList
            rows={rows}
            nameField={widget.config.nameField}
            valueField={widget.config.valueField}
          />
        )}
      </CardContent>
    </Card>
  );
}
