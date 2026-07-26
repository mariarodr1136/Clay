"use client";

import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import type { DemoColumn, DemoWidget } from "@/fixtures/demo-dashboards";
import { demoPerson, runDemoQuery, todayIso } from "@/fixtures/demo-data";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { DemoAvatar } from "@/components/demo/demo-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { taskStatuses, type taskPriorities } from "@/server/db/schema";
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

type TableWidget = Extract<DemoWidget, { type: "table" }>;

function DateCell({ row, value }: { row: Record<string, unknown>; value: string }) {
  const overdue = row.status !== "done" && value < todayIso();
  return (
    <span className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
      {format(parseISO(value), "MMM d")}
      {overdue && " · overdue"}
    </span>
  );
}

// Mirrors the live table's statusActions dropdown so the demo shows the
// affordance — demo fixtures are read-only, so a change explains itself.
function DemoStatusActionCell({ status }: { status: (typeof taskStatuses)[number] }) {
  return (
    <Select
      value={status}
      onValueChange={() =>
        toast.info("Demo data is read-only — sign up to update tasks from a view.")
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
  column: DemoColumn;
  row: Record<string, unknown>;
  statusActions?: boolean;
}) {
  const raw = row[column.key];
  if (raw == null || raw === "") return <span className="text-muted-foreground">—</span>;

  switch (column.kind) {
    case "status":
      if (statusActions) {
        return <DemoStatusActionCell status={raw as (typeof taskStatuses)[number]} />;
      }
      return <StatusBadge status={raw as (typeof taskStatuses)[number]} />;
    case "priority":
      return <PriorityBadge priority={raw as (typeof taskPriorities)[number]} />;
    case "person": {
      const person = row.assigneeId ? demoPerson(String(row.assigneeId)) : null;
      return (
        <span className="flex items-center gap-2">
          {person && <DemoAvatar person={person} />}
          <span className="whitespace-nowrap">{String(raw)}</span>
        </span>
      );
    }
    case "date":
      return <DateCell row={row} value={String(raw)} />;
    case "number":
      return <span className="tabular-nums">{String(raw)}</span>;
    case "tags":
      return (
        <span className="flex flex-wrap gap-1">
          {String(raw)
            .split(", ")
            .map((tag) => (
              <span key={tag} className="bg-muted rounded-full px-2 py-0.5 text-[11px] font-medium">
                {tag}
              </span>
            ))}
        </span>
      );
    default:
      return column.key === "title" ? (
        <span className="font-medium">{String(raw)}</span>
      ) : (
        <span>{String(raw)}</span>
      );
  }
}

export function DemoTableWidget({
  widget,
  filters,
}: {
  widget: TableWidget;
  filters: Record<string, string>;
}) {
  const rows = runDemoQuery(widget.query.queryId, widget.query.params ?? {}, filters);

  return (
    <Card className="h-full gap-3 overflow-auto">
      {widget.title && (
        <CardHeader className="flex items-baseline justify-between">
          <CardTitle className="text-sm">{widget.title}</CardTitle>
          <span className="text-muted-foreground text-xs tabular-nums">{rows.length} rows</span>
        </CardHeader>
      )}
      <CardContent>
        {rows.length === 0 && <p className="text-muted-foreground text-sm">No matching rows.</p>}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {widget.config.columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={c.kind === "number" ? "text-right" : undefined}
                  >
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
                      <CellValue column={c} row={row} statusActions={widget.config.statusActions} />
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
