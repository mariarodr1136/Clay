import "server-only";
import writeXlsxFile, { type Row, type Sheet, type SheetData } from "write-excel-file/node";
import type { ExportDataset } from "./datasets";

export type WorkbookMeta = {
  viewName: string;
  promptText: string | null;
  // Label/value pairs listed on the cover sheet under the prompt. Left open
  // so the live app can record workspace and version provenance while the
  // demo records its sample-data caveat.
  facts: [string, string][];
  generatedAt: Date;
  filters: Record<string, string>;
};

// Excel rejects these characters in sheet names and caps them at 31 chars.
const illegalSheetChars = /[[\]:*?/\\]/g;

const headerFill = "#f3f4f6";
const mutedText = "#6b7280";

export function sheetName(title: string, taken: Set<string>): string {
  const base = (title.replace(illegalSheetChars, " ").trim() || "Sheet").slice(0, 31);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let i = 2; ; i++) {
    const suffix = ` (${i})`;
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

// Timestamps become real Excel dates so they sort and filter as dates.
// Date-only strings ("2026-07-25", how Postgres `date` columns come back)
// stay text on purpose: converting them would push them across a day
// boundary for anyone west of UTC, and ISO text already sorts correctly.
function cell(raw: unknown): Row[number] {
  if (raw == null) return null;
  if (raw instanceof Date) return { value: raw, type: Date, format: "yyyy-mm-dd hh:mm" };
  if (typeof raw === "number") return { value: raw, type: Number };
  if (typeof raw === "boolean") return { value: raw, type: Boolean };
  if (typeof raw === "string") return { value: raw, type: String };
  return { value: JSON.stringify(raw), type: String };
}

function describeFilters(filters: Record<string, string>): string {
  const entries = Object.entries(filters);
  if (entries.length === 0) return "None";
  return entries.map(([key, value]) => `${key} = ${value}`).join(", ");
}

function coverSheet(
  meta: WorkbookMeta,
  sheets: { name: string; dataset: ExportDataset }[]
): Sheet<Buffer> {
  const data: SheetData = [
    [{ value: meta.viewName, type: String, fontWeight: "bold", fontSize: 16 }],
    [{ value: "Exported from Clay", type: String, textColor: mutedText }],
    [],
  ];

  // An agent-built dashboard is meaningless out of context: the prompt and
  // version behind it are what make these numbers auditable later.
  const facts: [string, string][] = [
    ["Built from prompt", meta.promptText ?? "—"],
    ...meta.facts,
    ["Filters applied", describeFilters(meta.filters)],
    ["Exported at", meta.generatedAt.toISOString()],
  ];

  for (const [label, value] of facts) {
    data.push([
      { value: label, type: String, fontWeight: "bold" },
      { value, type: String, wrap: true, alignVertical: "top" },
    ]);
  }

  data.push([]);
  data.push(
    ["Sheet", "Source query", "Rows", "Complete?"].map((label) => ({
      value: label,
      type: String,
      fontWeight: "bold" as const,
      backgroundColor: headerFill,
    }))
  );

  for (const { name, dataset } of sheets) {
    data.push([
      { value: name, type: String },
      { value: dataset.queryId, type: String },
      { value: dataset.rows.length, type: Number },
      {
        value: dataset.truncated ? `Truncated at ${dataset.rowLimit} rows` : "All rows",
        type: String,
      },
    ]);
  }

  return {
    sheet: "Overview",
    data,
    columns: [{ width: 22 }, { width: 52 }, { width: 10 }, { width: 24 }],
  };
}

function dataSheet(name: string, dataset: ExportDataset): Sheet<Buffer> {
  const header: Row = dataset.columns.map((column) => ({
    value: column.label,
    type: String,
    fontWeight: "bold",
    backgroundColor: headerFill,
  }));

  const data: SheetData = [header, ...dataset.rows.map((row) => dataset.columns.map((c) => cell(row[c.key])))];

  return {
    sheet: name,
    data,
    columns: dataset.columns.map((column) => ({
      width: Math.min(40, Math.max(12, column.label.length + 4)),
    })),
    // Header stays visible while scrolling a long extract.
    stickyRowsCount: 1,
  };
}

export async function buildViewWorkbook(
  meta: WorkbookMeta,
  datasets: ExportDataset[]
): Promise<Buffer> {
  const taken = new Set<string>(["Overview"]);
  const sheets = datasets.map((dataset) => ({
    name: sheetName(dataset.title, taken),
    dataset,
  }));

  return writeXlsxFile([
    coverSheet(meta, sheets),
    ...sheets.map(({ name, dataset }) => dataSheet(name, dataset)),
  ]).toBuffer();
}
