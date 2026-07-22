"use client";

import type { z } from "zod";
import type { kpiWidgetSchema, computedFieldWidgetSchema } from "@/lib/dsl/schema";
import { useCatalogQuery } from "../use-catalog-query";
import { Card, CardContent } from "@/components/ui/card";

function aggregate(rows: Record<string, unknown>[], field: string | undefined, mode: "count" | "sum") {
  if (mode === "count") return rows.length;
  return rows.reduce((sum, row) => sum + (Number(row[field ?? ""]) || 0), 0);
}

type Props = {
  widget: z.infer<typeof kpiWidgetSchema> | z.infer<typeof computedFieldWidgetSchema>;
  filters: Record<string, string>;
};

export function KpiWidget({ widget, filters }: Props) {
  const query = useCatalogQuery(widget.dataBinding, filters);
  const rows = (query.data ?? null) as Record<string, unknown>[] | null;
  const value = rows ? aggregate(rows, widget.config.field, widget.config.aggregate) : null;
  const display =
    value === null ? "—" : widget.config.format === "percent" ? `${value}%` : value.toLocaleString();

  return (
    <Card className="flex h-full flex-col items-center justify-center">
      <CardContent className="space-y-1 text-center">
        {query.error ? (
          <p className="text-destructive text-sm">{query.error.message}</p>
        ) : (
          <>
            <p className="text-3xl font-semibold">{display}</p>
            <p className="text-muted-foreground text-xs">{widget.config.label}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
