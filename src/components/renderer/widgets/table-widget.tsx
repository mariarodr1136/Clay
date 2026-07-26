"use client";

import type { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import type { tableWidgetSchema } from "@/lib/dsl/schema";
import { taskStatuses, type taskPriorities } from "@/server/db/schema";
import { trpc } from "@/lib/trpc/client";
import { useCatalogQuery } from "../use-catalog-query";
import { usePreloadedQueries } from "../preloaded-data";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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

// A status cell with statusActions on: the badge becomes a dropdown that
// fires the mutation catalog's updateTaskStatus for that row — the "views
// become little apps" path. Requires the row to carry a real task id.
function StatusActionCell({
  taskId,
  status,
}: {
  taskId: string;
  status: (typeof taskStatuses)[number];
}) {
  const utils = trpc.useUtils();
  const mutate = trpc.views.runMutation.useMutation({
    onSuccess: () => {
      utils.views.runQuery.invalidate();
      toast.success("Task updated");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Select
      value={status}
      disabled={mutate.isPending}
      onValueChange={(next) =>
        mutate.mutate({ mutationId: "updateTaskStatus", params: { taskId, status: next } })
      }
    >
      <SelectTrigger
        size="sm"
        className="hover:bg-muted h-7 gap-1 border-transparent bg-transparent px-1.5"
        aria-label="Change status"
      >
        <StatusBadge status={status} />
      </SelectTrigger>
      <SelectContent>
        {taskStatuses.map((s) => (
          <SelectItem key={s} value={s}>
            <StatusBadge status={s} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CellValue({
  column,
  row,
  statusActions,
}: {
  column: Column;
  row: Record<string, unknown>;
  statusActions?: boolean;
}) {
  const raw = row[column.key];
  if (raw == null || raw === "") return <span className="text-muted-foreground">—</span>;

  switch (column.kind) {
    case "status":
      if (statusActions && typeof row.id === "string") {
        return (
          <StatusActionCell taskId={row.id} status={raw as (typeof taskStatuses)[number]} />
        );
      }
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
  // Preloaded data means the print/PDF path — a snapshot is no place for a
  // live dropdown, so actions fall back to plain badges there.
  const preloaded = usePreloadedQueries();
  const statusActions = Boolean(widget.config.statusActions) && preloaded === null;

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
                      <CellValue column={c} row={row} statusActions={statusActions} />
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
