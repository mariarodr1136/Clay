import type { ExportColumn } from "./datasets";

// Excel and Sheets evaluate a cell whose text starts with =, +, -, @ (or a
// leading tab/CR) as a formula. A task titled `=HYPERLINK("http://evil","hi")`
// would then run on open — a CSV injection, and our rows are full of
// user-supplied text. Prefixing a single quote makes every major spreadsheet
// treat the value as literal text. XLSX doesn't need this: exceljs writes
// strings as string cells, and formulas require an explicit formula object.
const riskyPrefix = /^[=+\-@\t\r]/;

function neutralizeFormula(value: string): string {
  return riskyPrefix.test(value) ? `'${value}` : value;
}

function needsQuoting(value: string): boolean {
  return /[",\n\r]/.test(value);
}

export function csvCell(raw: unknown): string {
  if (raw == null) return "";

  let text: string;
  if (raw instanceof Date) text = raw.toISOString();
  else if (typeof raw === "object") text = JSON.stringify(raw);
  else text = String(raw);

  text = neutralizeFormula(text);
  return needsQuoting(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map((c) => csvCell(c.label)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c.key])).join(","));
  }
  // CRLF per RFC 4180, and a BOM so Excel on Windows reads it as UTF-8
  // instead of mangling non-ASCII names.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
