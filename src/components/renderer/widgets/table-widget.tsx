"use client";

import type { z } from "zod";
import { format, parseISO } from "date-fns";
import type { tableWidgetSchema } from "@/lib/dsl/schema";
import type { taskPriorities, taskStatuses } from "@/server/db/schema";
import { useCatalogQuery } from "../use-catalog-query";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Column = z.infer<typeof tableWidgetSchema>["config"]["columns"][number];

function DateCell({ row, value }: { row: Record<string, unknown>; value: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = row.status !== "done" && value < today;
  return (
    <span className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
      {format(parseISO(value), "MMM d")}
      {overdue && " · overdue"}
    </span>
  );
}

function CellValue({ column, row }: { column: Column; row: Record<string, unknown> }) {
  const raw = row[column.key];
  if (raw == null || raw === "") return <span className="text-muted-foreground">—</span>;

  switch (column.kind) {
    case "status":
      return <StatusBadge status={raw as (typeof taskStatuses)[number]} />;
    case "priority":
      return <PriorityBadge priority={raw as (typeof taskPriorities)[number]} />;
    case "date":
      return <DateCell row={row} value={String(raw).slice(0, 10)} />;
    case "number":
      return <span className="tabular-nums">{String(raw)}</span>;
    default:
      return column.key === "title" ? (
        <span className="font-medium">{String(raw)}</span>
      ) : (
        <span>{String(raw)}</span>
      );
  }
}

export function TableWidget({
  widget,
  filters,
}: {
  widget: z.infer<typeof tableWidgetSchema>;
  filters: Record<string, string>;
}) {
  const query = useCatalogQuery(widget.dataBinding, filters);
  const rows = (query.data ?? []) as Record<string, unknown>[];

  return (
    <Card className="h-full gap-3 overflow-auto">
      {widget.title && (
        <CardHeader className="flex items-baseline justify-between">
          <CardTitle className="text-sm">{widget.title}</CardTitle>
          {query.data && (
            <span className="text-muted-foreground text-xs tabular-nums">{rows.length} rows</span>
          )}
        </CardHeader>
      )}
      <CardContent>
        {query.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {query.error && <p className="text-destructive text-sm">{query.error.message}</p>}
        {query.data && rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No matching rows.</p>
        )}
        {query.data && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {widget.config.columns.map((c) => (
                  <TableHead key={c.key} className={c.kind === "number" ? "text-right" : undefined}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={String(row.id ?? i)}>
                  {widget.config.columns.map((c) => (
                    <TableCell key={c.key} className={c.kind === "number" ? "text-right" : undefined}>
                      <CellValue column={c} row={row} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
