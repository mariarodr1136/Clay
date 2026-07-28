import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import writeXlsxFile from "write-excel-file/node";
import { parseXlsx, excelSerialToIsoDate } from "./parse-xlsx";
import { mapRowsToTasks, suggestMapping } from "./map-tasks";
import { CsvParseError } from "./parse-csv";

// Builds a workbook by hand so a specific XLSX quirk can be exercised
// directly — shared strings, inline strings, gaps, rich-text runs.
function workbook(sheetXml: string, sharedStrings?: string[]) {
  const files: Record<string, Uint8Array> = {
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0"?><worksheet><sheetData>${sheetXml}</sheetData></worksheet>`
    ),
  };
  if (sharedStrings) {
    files["xl/sharedStrings.xml"] = strToU8(
      `<?xml version="1.0"?><sst>${sharedStrings.map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`
    );
  }
  return zipSync(files);
}

describe("parseXlsx", () => {
  it("resolves shared strings by index", () => {
    const sheet =
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>';
    const { headers, rows } = parseXlsx(workbook(sheet, ["Title", "Status", "Ship it", "done"]));
    expect(headers).toEqual(["Title", "Status"]);
    expect(rows).toEqual([["Ship it", "done"]]);
  });

  it("reads numbers and inline strings", () => {
    const sheet =
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Points</t></is></c></row>' +
      '<row r="2"><c r="A2"><v>8</v></c></row>';
    const { headers, rows } = parseXlsx(workbook(sheet));
    expect(headers).toEqual(["Points"]);
    expect(rows).toEqual([["8"]]);
  });

  it("keeps column positions when empty cells are omitted", () => {
    // Excel writes no <c> at all for a blank cell, so C2 must land in the
    // third slot rather than the second.
    const sheet =
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row>';
    const { rows } = parseXlsx(
      workbook(sheet, ["Title", "Notes", "Status", "Task one", "done"])
    );
    expect(rows).toEqual([["Task one", "", "done"]]);
  });

  it("joins rich-text runs back into one value", () => {
    const files: Record<string, Uint8Array> = {
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'
      ),
      // A bolded word splits one string across several <t> runs.
      "xl/sharedStrings.xml": strToU8(
        "<sst><si><r><t>Ship </t></r><r><t>the</t></r><r><t> beta</t></r></si></sst>"
      ),
    };
    expect(parseXlsx(zipSync(files)).headers).toEqual(["Ship the beta"]);
  });

  it("decodes XML entities", () => {
    const sheet = '<row r="1"><c r="A1" t="s"><v>0</v></c></row>';
    const { headers } = parseXlsx(workbook(sheet, ["Ship &amp; tell &lt;now&gt;"]));
    expect(headers).toEqual(["Ship & tell <now>"]);
  });

  it("skips rows that are entirely empty", () => {
    const sheet =
      '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>1</v></c></row>' +
      '<row r="3"><c r="A3"><v></v></c></row>' +
      '<row r="4"><c r="A4" t="s"><v>2</v></c></row>';
    const { rows } = parseXlsx(workbook(sheet, ["Title", "One", "Two"]));
    expect(rows).toEqual([["One"], ["Two"]]);
  });

  it("rejects a file that isn't a workbook", () => {
    expect(() => parseXlsx(strToU8("this is just text"))).toThrow(CsvParseError);
  });

  it("rejects a zip with no worksheets", () => {
    expect(() => parseXlsx(zipSync({ "docProps/app.xml": strToU8("<x/>") }))).toThrow(
      /no worksheets/
    );
  });
});

describe("Excel serial dates", () => {
  it("converts against the 1899-12-30 epoch", () => {
    expect(excelSerialToIsoDate(45000)).toBe("2023-03-15");
    expect(excelSerialToIsoDate(46000)).toBe("2025-12-09");
    // The epoch is off by one for serials below 61, because Excel counts a
    // 29th of February in 1900 that never happened. Irrelevant here: the
    // accepted range starts in 1954, decades past the discrepancy.
  });

  it("is read as a date when a due-date column contains one", () => {
    const parsed = {
      headers: ["Title", "Due"],
      rows: [["Ship it", "45000"]],
    };
    const { rows } = mapRowsToTasks(parsed, suggestMapping(parsed.headers));
    expect(rows[0].dueDate).toBe("2023-03-15");
  });

  it("does not mistake a small number for a date", () => {
    // Without the bounded range, Date would read "5" as a valid date.
    const parsed = { headers: ["Title", "Due"], rows: [["Ship it", "5"]] };
    const { rows, problems } = mapRowsToTasks(parsed, suggestMapping(parsed.headers));
    expect(rows[0].dueDate).toBeUndefined();
    expect(problems[0].message).toMatch(/Couldn't read/);
  });
});

describe("round trip through this app's own exporter", () => {
  it("reads back a workbook written by write-excel-file", async () => {
    // The strongest available check: the exporter is what users download,
    // so re-importing it has to work.
    // Same call shape src/server/export/xlsx.ts uses.
    const buffer = await writeXlsxFile([
      [
        { value: "Title", fontWeight: "bold" as const },
        { value: "Status", fontWeight: "bold" as const },
        { value: "Points", fontWeight: "bold" as const },
      ],
      [{ value: "Ship the beta" }, { value: "In Progress" }, { value: 8, type: Number }],
      [{ value: 'Quote " and, comma' }, { value: "Done" }, { value: 3, type: Number }],
    ]).toBuffer();

    const { headers, rows } = parseXlsx(new Uint8Array(buffer));
    expect(headers).toEqual(["Title", "Status", "Points"]);
    expect(rows[0]).toEqual(["Ship the beta", "In Progress", "8"]);
    expect(rows[1][0]).toBe('Quote " and, comma');

    // And the whole pipeline on top of it.
    const { rows: mapped, problems } = mapRowsToTasks(
      { headers, rows },
      suggestMapping(headers)
    );
    expect(problems).toEqual([]);
    expect(mapped.map((r) => [r.title, r.status, r.points])).toEqual([
      ["Ship the beta", "in_progress", 8],
      ['Quote " and, comma', "done", 3],
    ]);
  });
});
