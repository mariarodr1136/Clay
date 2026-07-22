"use client";

import Link from "next/link";
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-muted-foreground text-sm">
          Every view created or changed in this organization — who or what did it, and why.
        </p>
      </div>

      {activityQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {activityQuery.data && activityQuery.data.length === 0 && (
        <p className="text-muted-foreground text-sm">No activity yet.</p>
      )}

      {activityQuery.data && activityQuery.data.length > 0 && (
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
                  <Badge variant={entry.createdBy === "agent" ? "default" : "outline"}>
                    {entry.createdBy}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                  {entry.promptText ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
