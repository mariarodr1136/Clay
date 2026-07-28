// RFC 4180 reader, the mirror of the writer in src/server/export/csv.ts.
//
// Hand-rolled for the same reason the writer is: the format's whole
// difficulty lives in quoting, and the rules are short enough to state
// exactly. A character-by-character scan handles the cases a naive
// split(",") gets wrong — quoted fields containing commas, escaped quotes
// (""), and newlines *inside* a quoted field, which is what a pasted
// multi-line task description looks like.

export const MAX_IMPORT_ROWS = 5000;

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// The writer prefixes a quote onto values that would otherwise be read as a
// spreadsheet formula. Round-tripping our own export shouldn't leave that
// artifact behind in the data.
function unescapeFormulaGuard(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

export function parseCsv(input: string): ParsedCsv {
  const text = stripBom(input);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let sawAnyChar = false;

  const endField = () => {
    row.push(unescapeFormulaGuard(field));
    field = "";
  };
  const endRow = () => {
    endField();
    // A trailing newline produces a final empty row; a row of nothing but
    // empty cells is padding, not data.
    if (row.some((cell) => cell !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    sawAnyChar = true;

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\r") {
      // CRLF and a bare CR both end the record.
      if (text[i + 1] === "\n") i++;
      endRow();
    } else if (char === "\n") {
      endRow();
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new CsvParseError("The file has an unclosed quote — check for a stray \" character.");
  }
  if (sawAnyChar) endRow();

  if (rows.length === 0) {
    throw new CsvParseError("That file has no rows in it.");
  }

  const [headers, ...body] = rows;
  if (body.length > MAX_IMPORT_ROWS) {
    throw new CsvParseError(
      `That file has ${body.length} rows; imports are capped at ${MAX_IMPORT_ROWS}.`
    );
  }

  return { headers: headers.map((h) => h.trim()), rows: body };
}
