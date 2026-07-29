import { unzipSync, strFromU8 } from "fflate";
import { CsvParseError, MAX_IMPORT_ROWS, type ParsedCsv } from "./parse-csv";

// Reader for .xlsx, producing the same shape as the CSV parser so everything
// downstream — column matching, validation, the preview — is shared.
//
// An .xlsx file is a zip of XML. Only three parts matter for reading a flat
// table: the workbook (which sheet comes first), the worksheet itself, and
// the shared string table, since Excel stores most text once and references
// it by index rather than repeating it in every cell.
//
// Hand-rolled for the same reason the CSV reader is: a full spreadsheet
// library brings formulas, styles, charts and pivot caches to solve a
// problem that is "read the cells of one sheet".

// Excel's epoch is 1899-12-30 — 1900-01-00 in its own reckoning, offset by
// the famous phantom leap day it inherited from Lotus 1-2-3.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export function excelSerialToIsoDate(serial: number): string {
  return new Date(EXCEL_EPOCH_MS + Math.round(serial) * MS_PER_DAY).toISOString().slice(0, 10);
}

// Column letters to a zero-based index: A→0, Z→25, AA→26. Needed because a
// row omits empty cells entirely, so position has to be read from each
// cell's own reference rather than counted.
function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1];
  if (!letters) return 0;
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Ampersand last, so &amp;lt; doesn't become a tag.
    .replace(/&amp;/g, "&");
}

// Concatenates the <t> runs inside one element. Rich text splits a single
// string across several runs (a bolded word makes its own), and joining them
// is what turns that back into the text the user sees.
function textRuns(xml: string): string {
  const parts = [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
  return decodeXmlEntities(parts.join(""));
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textRuns(match[1]));
}

function firstSheetPath(files: Record<string, Uint8Array>): string {
  // Sheets are named sheet1.xml, sheet2.xml… but not guaranteed to be, and
  // the first in the workbook isn't necessarily the lowest number. Reading
  // the relationship graph properly means three more files; sorting the
  // worksheet names is right for every file a person actually exports.
  const sheets = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name))
    .sort();
  if (sheets.length === 0) {
    throw new CsvParseError("That .xlsx file has no worksheets in it.");
  }
  return sheets[0];
}

export function parseXlsx(buffer: Uint8Array): ParsedCsv {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new CsvParseError("That file isn't a readable .xlsx workbook.");
  }

  const sharedStrings = parseSharedStrings(
    files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : undefined
  );

  const sheetXml = strFromU8(files[firstSheetPath(files)]);
  const rows: string[][] = [];

  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];

    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g)) {
      const attrs = cellMatch[1] ?? cellMatch[3] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1];

      // Empty cells are omitted from the XML, so gaps are filled by position
      // rather than assuming cells arrive contiguously.
      const index = ref ? columnIndex(ref) : cells.length;
      while (cells.length < index) cells.push("");

      let value = "";
      if (type === "s") {
        const stringIndex = Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "-1");
        value = sharedStrings[stringIndex] ?? "";
      } else if (type === "inlineStr") {
        value = textRuns(body);
      } else {
        value = decodeXmlEntities(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }

      cells[index] = value;
    }

    // Same rule as the CSV reader: a row of nothing but empty cells is
    // padding, not data.
    if (cells.some((cell) => cell !== "")) rows.push(cells);
  }

  if (rows.length === 0) {
    throw new CsvParseError("That workbook has no rows in it.");
  }

  const [headers, ...body] = rows;
  if (body.length > MAX_IMPORT_ROWS) {
    throw new CsvParseError(
      `That workbook has ${body.length} rows; imports are capped at ${MAX_IMPORT_ROWS}.`
    );
  }

  return { headers: headers.map((h) => h.trim()), rows: body };
}
