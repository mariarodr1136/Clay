import { z } from "zod";
import { taskPriorities, taskStatuses, type TaskPriority, type TaskStatus } from "@/server/db/schema";
import { IMPORT_FIELDS, type ImportField } from "@/lib/import-fields";
import { excelSerialToIsoDate } from "./parse-xlsx";
import type { ParsedCsv } from "./parse-csv";

// The task fields an import can populate — the same set the createTask
// mutation accepts, plus status and assignee. Anything outside this is
// ignored rather than guessed at. The list itself lives in src/lib so the
// import dialog can render it without importing this module.
export { IMPORT_FIELDS, type ImportField };

// column index in the CSV -> task field. Null means "don't import this
// column", which is the default for anything unrecognised.
export const mappingSchema = z.record(z.string(), z.enum(IMPORT_FIELDS).nullable());
export type ImportMapping = z.infer<typeof mappingSchema>;

// Header names we'll match without the user having to map anything by hand.
// Matching is case- and punctuation-insensitive, so "Due Date", "due_date"
// and "DUEDATE" all land on dueDate.
const HEADER_ALIASES: Record<string, ImportField> = {
  title: "title",
  name: "title",
  task: "title",
  summary: "title",
  taskname: "title",
  tasktitle: "title",
  itemname: "title",
  issuetitle: "title",
  subject: "title",
  description: "description",
  details: "description",
  notes: "description",
  status: "status",
  state: "status",
  column: "status",
  priority: "priority",
  duedate: "dueDate",
  due: "dueDate",
  deadline: "dueDate",
  points: "points",
  estimate: "points",
  storypoints: "points",
  assignee: "assignee",
  owner: "assignee",
  assignedto: "assignee",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function suggestMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const taken = new Set<ImportField>();

  headers.forEach((header, index) => {
    const candidate = HEADER_ALIASES[normalizeHeader(header)];
    // First column to claim a field wins; a second "Name" column is left
    // unmapped rather than silently overwriting the first.
    if (candidate && !taken.has(candidate)) {
      mapping[String(index)] = candidate;
      taken.add(candidate);
    } else {
      mapping[String(index)] = null;
    }
  });

  return mapping;
}

// Spreadsheet status values rarely match our enum exactly.
const STATUS_ALIASES: Record<string, TaskStatus> = {
  todo: "todo",
  backlog: "todo",
  new: "todo",
  open: "todo",
  notstarted: "todo",
  inprogress: "in_progress",
  doing: "in_progress",
  started: "in_progress",
  active: "in_progress",
  wip: "in_progress",
  inreview: "in_review",
  review: "in_review",
  codereview: "in_review",
  done: "done",
  complete: "done",
  completed: "done",
  closed: "done",
  shipped: "done",
};

const PRIORITY_ALIASES: Record<string, TaskPriority> = {
  low: "low",
  p3: "low",
  minor: "low",
  medium: "medium",
  med: "medium",
  normal: "medium",
  p2: "medium",
  high: "high",
  p1: "high",
  major: "high",
  urgent: "urgent",
  p0: "urgent",
  critical: "urgent",
  blocker: "urgent",
};

export type ImportRow = {
  // 1-based, and counting the header — matches the row number the user sees
  // in their spreadsheet, so an error message points at the right line.
  lineNumber: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  points: number;
  assigneeName?: string;
};

export type RowProblem = {
  lineNumber: number;
  message: string;
};

export type MappedImport = {
  rows: ImportRow[];
  problems: RowProblem[];
};

// Excel stores dates as days since 1899-12-30, so a real date cell arrives
// as a bare number like 46200. The range is bounded deliberately: 20000 is
// 1954 and 60000 is 2064, which is narrow enough that a genuine numeric
// value in a date column (a duration, an ID) is unlikely to be inside it and
// wide enough to cover any date anyone puts on a task.
const EXCEL_SERIAL_MIN = 20_000;
const EXCEL_SERIAL_MAX = 60_000;

function parseDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Already ISO (YYYY-MM-DD) — the format our own export writes.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial >= EXCEL_SERIAL_MIN && serial <= EXCEL_SERIAL_MAX) {
      return excelSerialToIsoDate(serial);
    }
    // A number outside that window is not a date anyone meant; falling
    // through to Date would read "5" as 2001-05-01.
    return undefined;
  }

  // Anything else goes through Date, which handles "Mar 3, 2026" and
  // "2026/03/03". Ambiguous US-vs-EU numeric dates are the one case nothing
  // can resolve for certain, so they're read the way JS reads them and the
  // preview shows the result before anything is written.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

// Turns raw CSV rows into task-shaped records, collecting per-row problems
// instead of throwing — an import of 200 rows shouldn't fail wholesale
// because row 137 has a typo in its status.
export function mapRowsToTasks(parsed: ParsedCsv, mapping: ImportMapping): MappedImport {
  const rows: ImportRow[] = [];
  const problems: RowProblem[] = [];

  const fieldToIndex = new Map<ImportField, number>();
  for (const [index, field] of Object.entries(mapping)) {
    if (field) fieldToIndex.set(field, Number(index));
  }

  const titleIndex = fieldToIndex.get("title");
  if (titleIndex === undefined) {
    return { rows: [], problems: [{ lineNumber: 0, message: "Map a column to Title first." }] };
  }

  parsed.rows.forEach((cells, offset) => {
    const lineNumber = offset + 2; // +1 for the header, +1 for 1-based
    const cellAt = (field: ImportField) => {
      const index = fieldToIndex.get(field);
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };

    const title = cellAt("title");
    if (!title) {
      problems.push({ lineNumber, message: "No title — row skipped." });
      return;
    }
    if (title.length > 300) {
      problems.push({ lineNumber, message: "Title is longer than 300 characters — row skipped." });
      return;
    }

    const rawStatus = cellAt("status");
    const status = rawStatus
      ? STATUS_ALIASES[rawStatus.toLowerCase().replace(/[^a-z0-9]/g, "")]
      : "todo";
    if (rawStatus && !status) {
      problems.push({
        lineNumber,
        message: `Status "${rawStatus}" isn't recognised — imported as To do.`,
      });
    }

    const rawPriority = cellAt("priority");
    const priority = rawPriority
      ? PRIORITY_ALIASES[rawPriority.toLowerCase().replace(/[^a-z0-9]/g, "")]
      : "medium";
    if (rawPriority && !priority) {
      problems.push({
        lineNumber,
        message: `Priority "${rawPriority}" isn't recognised — imported as Medium.`,
      });
    }

    const rawDue = cellAt("dueDate");
    const dueDate = rawDue ? parseDate(rawDue) : undefined;
    if (rawDue && !dueDate) {
      problems.push({
        lineNumber,
        message: `Couldn't read "${rawDue}" as a date — imported with no due date.`,
      });
    }

    const rawPoints = cellAt("points");
    let points = 0;
    if (rawPoints) {
      const parsedPoints = Number(rawPoints);
      if (!Number.isFinite(parsedPoints) || parsedPoints < 0 || parsedPoints > 100) {
        problems.push({
          lineNumber,
          message: `Points value "${rawPoints}" isn't a number between 0 and 100 — imported as 0.`,
        });
      } else {
        points = Math.round(parsedPoints);
      }
    }

    const description = cellAt("description").slice(0, 4000) || undefined;
    const assigneeName = cellAt("assignee") || undefined;

    rows.push({
      lineNumber,
      title,
      description,
      status: status ?? "todo",
      priority: priority ?? "medium",
      dueDate,
      points,
      assigneeName,
    });
  });

  return { rows, problems };
}

export { taskStatuses, taskPriorities };
