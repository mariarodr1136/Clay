"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { IMPORT_FIELDS, IMPORT_FIELD_LABELS, type ImportField } from "@/lib/import-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SKIP = "__skip__";

type Mapping = Record<string, ImportField | null>;

// Three steps, because a half-finished spreadsheet import is much worse than
// one that refuses to start: read the headers, let the user correct the
// guessed mapping, then dry-run the whole file before anything is written.
export function ImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);

  const [csv, setCsv] = useState("");
  // Set instead of `csv` when the user picks a workbook. Exactly one of the
  // two travels with every request.
  const [xlsxBase64, setXlsxBase64] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});

  const reset = () => {
    setCsv("");
    setXlsxBase64(null);
    setFileLabel(null);
    setHeaders([]);
    setMapping({});
    inspect.reset();
    preview.reset();
  };

  // What every mutation needs to identify the uploaded file.
  const source = () => (xlsxBase64 ? { xlsxBase64 } : { csv });

  const inspect = trpc.import.inspect.useMutation({
    onSuccess: (data) => {
      setHeaders(data.headers);
      setMapping(data.suggestedMapping as Mapping);
    },
    onError: (err) => toast.error(err.message),
  });

  const preview = trpc.import.preview.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const commit = trpc.import.commit.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.imported} tasks`, {
        description: result.problems.length
          ? `${result.problems.length} row${result.problems.length === 1 ? "" : "s"} needed attention — see the preview next time.`
          : undefined,
      });
      utils.tasks.listByProject.invalidate();
      utils.tasks.stats.invalidate();
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const readFile = async (file: File) => {
    setFileLabel(file.name);

    if (/\.xlsx$/i.test(file.name)) {
      // Base64 rather than multipart: the payload goes through the same
      // tRPC procedure as pasted CSV, so there's one validated entry point
      // instead of a second upload route to secure separately.
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const encoded = btoa(binary);
      setCsv("");
      setXlsxBase64(encoded);
      inspect.mutate({ xlsxBase64: encoded });
      return;
    }

    const text = await file.text();
    setXlsxBase64(null);
    setCsv(text);
    inspect.mutate({ csv: text });
  };

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const hasTitle = mappedFields.has("title");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import tasks from a spreadsheet</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file, or paste CSV below. Nothing is saved until you confirm the
            preview.
          </DialogDescription>
        </DialogHeader>

        {headers.length === 0 && (
          <div className="space-y-4">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInput.current?.click()}
              disabled={inspect.isPending}
            >
              <Upload data-icon="inline-start" />
              {fileLabel ?? "Choose a CSV or Excel file"}
            </Button>

            <div className="space-y-2">
              <Label htmlFor="csv-paste">…or paste CSV</Label>
              <Textarea
                id="csv-paste"
                rows={6}
                value={csv}
                placeholder={"Title,Status,Due\nShip the beta,in progress,2026-08-01"}
                onChange={(event) => setCsv(event.target.value)}
              />
              <Button
                type="button"
                size="sm"
                disabled={!csv.trim() || inspect.isPending}
                onClick={() => inspect.mutate({ csv })}
              >
                {inspect.isPending ? "Reading…" : "Read columns"}
              </Button>
            </div>
          </div>
        )}

        {headers.length > 0 && (
          <div className="space-y-5">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold tracking-wide uppercase">Match columns</h3>
                <span className="text-muted-foreground text-xs">
                  {inspect.data?.rowCount ?? 0} rows found
                </span>
              </div>

              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="w-1/2 truncate text-sm font-medium" title={header}>
                      {header || <em className="text-muted-foreground">(no header)</em>}
                    </span>
                    <Select
                      value={mapping[String(index)] ?? SKIP}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          [String(index)]: value === SKIP ? null : (value as ImportField),
                        }))
                      }
                    >
                      <SelectTrigger size="sm" className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>Don&apos;t import</SelectItem>
                        {IMPORT_FIELDS.map((field) => (
                          <SelectItem key={field} value={field}>
                            {IMPORT_FIELD_LABELS[field]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {!hasTitle && (
                <p className="text-destructive flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="size-3.5" />
                  One column has to be the task title.
                </p>
              )}
            </section>

            {preview.data && (
              <section className="space-y-2 border-t pt-4">
                <h3 className="text-xs font-semibold tracking-wide uppercase">Preview</h3>
                <p className="text-sm">
                  <strong>{preview.data.willCreate}</strong> tasks will be created.
                </p>

                {preview.data.unmatchedAssignees.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    Not workspace members, so those tasks will be unassigned:{" "}
                    {preview.data.unmatchedAssignees.join(", ")}
                  </p>
                )}

                {preview.data.problems.length > 0 && (
                  <details className="text-xs">
                    <summary className="text-muted-foreground cursor-pointer">
                      {preview.data.problems.length} row
                      {preview.data.problems.length === 1 ? "" : "s"} need attention
                    </summary>
                    <ul className="text-muted-foreground mt-2 space-y-1">
                      {preview.data.problems.slice(0, 25).map((problem, i) => (
                        <li key={i}>
                          Line {problem.lineNumber}: {problem.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}
          </div>
        )}

        {headers.length > 0 && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={reset}>
              Start over
            </Button>
            {!preview.data ? (
              <Button
                type="button"
                disabled={!hasTitle || preview.isPending}
                onClick={() => preview.mutate({ projectId, mapping, ...source() })}
              >
                {preview.isPending ? "Checking…" : "Preview import"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={commit.isPending || preview.data.willCreate === 0}
                onClick={() => commit.mutate({ projectId, mapping, ...source() })}
              >
                {commit.isPending
                  ? "Importing…"
                  : `Import ${preview.data.willCreate} task${preview.data.willCreate === 1 ? "" : "s"}`}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
