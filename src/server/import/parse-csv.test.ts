import { describe, expect, it } from "vitest";
import { parseCsv, CsvParseError, MAX_IMPORT_ROWS } from "./parse-csv";
import { toCsv } from "@/server/export/csv";

describe("parseCsv", () => {
  it("reads a plain file", () => {
    const { headers, rows } = parseCsv("Title,Status\nShip it,done\nFix it,todo");
    expect(headers).toEqual(["Title", "Status"]);
    expect(rows).toEqual([
      ["Ship it", "done"],
      ["Fix it", "todo"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    const { rows } = parseCsv('Title,Notes\n"Ship, then tell",done');
    expect(rows[0]).toEqual(["Ship, then tell", "done"]);
  });

  it("reads doubled quotes as a literal quote", () => {
    const { rows } = parseCsv('Title\n"He said ""ship it"""');
    expect(rows[0]).toEqual(['He said "ship it"']);
  });

  it("keeps newlines inside a quoted field", () => {
    const { rows } = parseCsv('Title,Description\nShip,"line one\nline two"');
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("line one\nline two");
  });

  it("handles CRLF, a trailing newline, and a BOM", () => {
    const { headers, rows } = parseCsv("﻿Title,Status\r\nShip,done\r\n");
    expect(headers).toEqual(["Title", "Status"]);
    expect(rows).toEqual([["Ship", "done"]]);
  });

  it("skips blank rows rather than importing empty tasks", () => {
    const { rows } = parseCsv("Title\nShip\n\n,\nFix");
    expect(rows).toEqual([["Ship"], ["Fix"]]);
  });

  it("rejects an unclosed quote instead of silently truncating", () => {
    expect(() => parseCsv('Title\n"never closed')).toThrow(CsvParseError);
  });

  it("rejects a file over the row cap", () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Task ${i}`).join("\n");
    expect(() => parseCsv(`Title\n${body}`)).toThrow(/capped at/);
  });

  it("round-trips this app's own CSV export", () => {
    // The export writer prefixes a quote onto formula-looking values to
    // defuse CSV injection; re-importing must not leave that artifact in
    // the data.
    const csv = toCsv(
      [
        { key: "title", label: "Title" },
        { key: "note", label: "Note" },
      ],
      [
        { title: "=SUM(A1:A2)", note: 'quote " and, comma' },
        { title: "Ordinary task", note: "line\nbreak" },
      ]
    );

    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["Title", "Note"]);
    expect(rows[0]).toEqual(["=SUM(A1:A2)", 'quote " and, comma']);
    expect(rows[1]).toEqual(["Ordinary task", "line\nbreak"]);
  });
});
