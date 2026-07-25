import { describe, expect, it } from "vitest";
import { toCsv, csvCell } from "./csv";
import { humanize } from "./datasets";
import { sheetName } from "./xlsx";
import { resolveBindingParams } from "@/lib/dsl/resolve-params";
import { clampInteractiveParams } from "@/server/data-access/catalog";
import { EXPORT_ROW_LIMIT, INTERACTIVE_ROW_LIMIT } from "@/server/data-access/limits";
import { tasksListParams } from "@/server/data-access/queries/tasks-list";

describe("csv serialization", () => {
  it("quotes values containing commas, quotes, or newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes values a spreadsheet would evaluate as a formula", () => {
    // A task title is user-supplied text; it must never execute on open.
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""x"")"'
    );
    expect(csvCell("+1234")).toBe("'+1234");
    expect(csvCell("-lead")).toBe("'-lead");
    expect(csvCell("@handle")).toBe("'@handle");
  });

  it("renders empty cells for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("writes a BOM, a header row, and CRLF line endings", () => {
    const csv = toCsv(
      [
        { key: "title", label: "Task" },
        { key: "points", label: "Points" },
      ],
      [{ title: "Ship it", points: 3 }]
    );
    expect(csv).toBe("﻿Task,Points\r\nShip it,3\r\n");
  });
});

describe("filter resolution", () => {
  it("replaces $filter refs with live filter values", () => {
    expect(resolveBindingParams({ status: "$filter:status", limit: 50 }, { status: "todo" })).toEqual(
      { status: "todo", limit: 50 }
    );
  });

  it("omits the param entirely when the filter is unset", () => {
    expect(resolveBindingParams({ status: "$filter:status" }, {})).toEqual({});
  });

  it("leaves ordinary string params alone", () => {
    expect(resolveBindingParams({ status: "done" }, { status: "todo" })).toEqual({
      status: "done",
    });
  });
});

describe("row limits", () => {
  it("lets export-sized limits through the params schema", () => {
    expect(tasksListParams.parse({ limit: EXPORT_ROW_LIMIT }).limit).toBe(EXPORT_ROW_LIMIT);
  });

  it("clamps interactive callers back to the widget ceiling", () => {
    expect(clampInteractiveParams({ limit: EXPORT_ROW_LIMIT })).toEqual({
      limit: INTERACTIVE_ROW_LIMIT,
    });
  });

  it("leaves limits at or under the interactive ceiling untouched", () => {
    const params = { limit: 25, status: "todo" };
    expect(clampInteractiveParams(params)).toBe(params);
  });

  it("passes through params with no limit at all", () => {
    const params = { status: "todo" };
    expect(clampInteractiveParams(params)).toBe(params);
  });
});

describe("sheet names", () => {
  it("strips characters Excel rejects and caps length at 31", () => {
    expect(sheetName("Tasks: by [project]/status", new Set())).toBe("Tasks  by  project  status");
    expect(sheetName("x".repeat(40), new Set())).toHaveLength(31);
  });

  it("disambiguates duplicates", () => {
    const taken = new Set<string>();
    expect(sheetName("Overdue", taken)).toBe("Overdue");
    expect(sheetName("Overdue", taken)).toBe("Overdue (2)");
    expect(sheetName("Overdue", taken)).toBe("Overdue (3)");
  });
});

describe("column labels", () => {
  it("turns field names into readable headers", () => {
    expect(humanize("dueDate")).toBe("Due date");
    expect(humanize("assignee_id")).toBe("Assignee id");
    expect(humanize("in_progress")).toBe("In progress");
  });
});
