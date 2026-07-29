import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse-csv";
import { mapRowsToTasks, suggestMapping } from "./map-tasks";

const map = (csv: string) => {
  const parsed = parseCsv(csv);
  return mapRowsToTasks(parsed, suggestMapping(parsed.headers));
};

describe("suggestMapping", () => {
  it("matches headers regardless of case and punctuation", () => {
    const mapping = suggestMapping(["Task Name", "DUE_DATE", "Assigned To", "Story Points"]);
    expect(mapping).toEqual({
      "0": "title",
      "1": "dueDate",
      "2": "assignee",
      "3": "points",
    });
  });

  it("leaves a duplicate column unmapped rather than overwriting the first", () => {
    const mapping = suggestMapping(["Title", "Name"]);
    expect(mapping["0"]).toBe("title");
    expect(mapping["1"]).toBeNull();
  });

  it("leaves unrecognised columns alone", () => {
    expect(suggestMapping(["Jira Key", "Sprint"])).toEqual({ "0": null, "1": null });
  });
});

describe("mapRowsToTasks", () => {
  it("translates common status and priority wording", () => {
    const { rows } = map(
      "Title,Status,Priority\nA,In Progress,P1\nB,Backlog,critical\nC,Closed,normal"
    );
    expect(rows.map((r) => r.status)).toEqual(["in_progress", "todo", "done"]);
    expect(rows.map((r) => r.priority)).toEqual(["high", "urgent", "medium"]);
  });

  it("defaults missing status and priority instead of failing", () => {
    const { rows, problems } = map("Title\nJust a title");
    expect(rows[0]).toMatchObject({ status: "todo", priority: "medium", points: 0 });
    expect(problems).toHaveLength(0);
  });

  it("reports an unrecognised status but still imports the row", () => {
    const { rows, problems } = map("Title,Status\nA,Sprintish");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("todo");
    expect(problems[0].message).toMatch(/isn't recognised/);
  });

  it("reads ISO and written dates, and reports ones it cannot", () => {
    const { rows, problems } = map("Title,Due\nA,2026-03-04\nB,March 4 2026\nC,soon");
    expect(rows[0].dueDate).toBe("2026-03-04");
    expect(rows[1].dueDate).toBe("2026-03-04");
    expect(rows[2].dueDate).toBeUndefined();
    expect(problems[0]).toMatchObject({ lineNumber: 4 });
  });

  it("skips titleless rows and points at the spreadsheet line number", () => {
    const { rows, problems } = map("Title,Status\nA,todo\n,done\nC,todo");
    expect(rows.map((r) => r.title)).toEqual(["A", "C"]);
    // Header is line 1, so the empty row is line 3.
    expect(problems[0]).toMatchObject({ lineNumber: 3, message: "No title — row skipped." });
  });

  it("rejects out-of-range points but keeps the task", () => {
    const { rows, problems } = map("Title,Points\nA,8\nB,-3\nC,abc");
    expect(rows.map((r) => r.points)).toEqual([8, 0, 0]);
    expect(problems).toHaveLength(2);
  });

  it("refuses to import at all when no column maps to title", () => {
    const parsed = parseCsv("Status,Priority\ntodo,high");
    const { rows, problems } = mapRowsToTasks(parsed, { "0": "status", "1": "priority" });
    expect(rows).toHaveLength(0);
    expect(problems[0].message).toMatch(/Map a column to Title/);
  });
});
