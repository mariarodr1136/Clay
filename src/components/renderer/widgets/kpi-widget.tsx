"use client";

import type { z } from "zod";
import type { kpiWidgetSchema, computedFieldWidgetSchema } from "@/lib/dsl/schema";
import { useCatalogQuery } from "../use-catalog-query";
import { Card, CardContent } from "@/components/ui/card";

function aggregate(
  rows: Record<string, unknown>[],
  field: string | undefined,
  mode: "count" | "sum" | "avg"
) {
  if (mode === "count") return rows.length;
  const sum = rows.reduce((acc, row) => acc + (Number(row[field ?? ""]) || 0), 0);
  if (mode === "sum") return sum;
  return rows.length === 0 ? 0 : Math.round((sum / rows.length) * 10) / 10;
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
    <Card className="h-full gap-0 py-4">
      <CardContent className="flex h-full flex-col px-4">
        {query.error ? (
          <p className="text-destructive text-sm">{query.error.message}</p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs font-medium">{widget.config.label}</p>
            <div className="my-auto py-1.5">
              <p
                className="text-[28px] leading-none font-semibold tracking-tight"
                style={
                  widget.config.intent === "danger" ? { color: "var(--destructive)" } : undefined
                }
              >
                {display}
              </p>
              {widget.config.note && (
                <p className="text-muted-foreground mt-2 text-xs">{widget.config.note}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
