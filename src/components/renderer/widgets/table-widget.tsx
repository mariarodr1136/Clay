"use client";

import type { z } from "zod";
import type { tableWidgetSchema } from "@/lib/dsl/schema";
import { useCatalogQuery } from "../use-catalog-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <Card className="h-full overflow-auto">
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
          <Table>
            <TableHeader>
              <TableRow>
                {widget.config.columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {widget.config.columns.map((c) => (
                    <TableCell key={c.key}>{String(row[c.key] ?? "—")}</TableCell>
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
