"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ScrollText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AuditPage() {
  const activityQuery = trpc.views.listActivity.useQuery({ limit: 50 });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground text-sm">
          Every view created or changed in this organization — who or what did it, and why.
        </p>
      </div>

      {activityQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {activityQuery.data && activityQuery.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <ScrollText className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No activity yet</p>
        </div>
      )}

      {activityQuery.data && activityQuery.data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>View</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityQuery.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Link href={`/views/${entry.viewId}`} className="hover:underline">
                      {entry.viewName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        entry.createdBy === "agent"
                          ? "border-transparent bg-accent text-accent-foreground"
                          : ""
                      }
                    >
                      {entry.createdBy}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                    {entry.promptText ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground text-sm"
                    title={new Date(entry.createdAt).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
