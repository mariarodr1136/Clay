"use client";

import { Download, FileSpreadsheet, FileText, Printer, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ExportableTable = { id: string; title: string };

// Knows nothing about either DSL — the live view page and the demo view page
// each hand it their own tables and their own export endpoint.
export function ExportMenu({
  exportPath,
  tables,
  filters,
}: {
  exportPath: string;
  tables: ExportableTable[];
  filters: Record<string, string>;
}) {
  const href = (format: "csv" | "xlsx" | "pdf", widgetId?: string) => {
    const params = new URLSearchParams({ format });
    if (widgetId) params.set("widgetId", widgetId);
    // The route re-resolves "$filter:" bindings against these, so the file
    // reflects the filter bar as the user left it.
    if (Object.keys(filters).length > 0) params.set("filters", JSON.stringify(filters));
    return `${exportPath}?${params.toString()}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="size-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      {/* print-hidden as well as the trigger: the menu is still mounted when
          window.print() snapshots the page, and an open dropdown in the PDF
          is a strange thing to hand a stakeholder. */}
      <DropdownMenuContent align="end" className="print-hidden w-64">
        <DropdownMenuItem asChild>
          <a href={href("xlsx")} download>
            <FileSpreadsheet className="size-3.5" />
            Excel workbook (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("pdf")} download>
            <FileText className="size-3.5" />
            Download PDF (.pdf)
          </a>
        </DropdownMenuItem>
        {/* Kept alongside the download: the browser dialog is still the way
            to pick a paper size, a page range, or an actual printer. */}
        <DropdownMenuItem onSelect={() => setTimeout(() => window.print(), 0)}>
          <Printer className="size-3.5" />
          Print…
        </DropdownMenuItem>

        {tables.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Download a table as CSV
            </DropdownMenuLabel>
            {tables.map((table) => (
              <DropdownMenuItem key={table.id} asChild>
                <a href={href("csv", table.id)} download>
                  <Table2 className="size-3.5" />
                  <span className="truncate">{table.title}</span>
                </a>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
