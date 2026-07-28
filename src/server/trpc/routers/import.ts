import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { memberships, projects, tasks, users } from "@/server/db/schema";
import { parseCsv, CsvParseError, MAX_IMPORT_ROWS } from "@/server/import/parse-csv";
import { parseXlsx } from "@/server/import/parse-xlsx";
import { mapRowsToTasks, mappingSchema, suggestMapping } from "@/server/import/map-tasks";
import { InvalidRequestError, NotFoundError } from "@/server/errors";

// 4 MB. The row cap is the real limit; this just stops a pathological
// payload from being parsed at all. A workbook arrives base64-encoded, which
// costs about a third in size, hence the slightly larger ceiling.
const csvInput = z.string().min(1).max(4_000_000);
const xlsxInput = z.string().min(1).max(6_000_000);

// Either a pasted/uploaded CSV or a base64 .xlsx. Both parse to the same
// shape, so column matching, validation and preview are shared.
const fileInput = z
  .object({
    csv: csvInput.optional(),
    xlsxBase64: xlsxInput.optional(),
  })
  .refine((input) => Boolean(input.csv) !== Boolean(input.xlsxBase64), {
    message: "Provide exactly one of csv or xlsxBase64",
  });

async function ownProject(organizationId: string, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
  });
  if (!project) throw new NotFoundError("Project");
  return project;
}

function parseOrThrow(input: { csv?: string; xlsxBase64?: string }) {
  try {
    if (input.xlsxBase64) {
      return parseXlsx(new Uint8Array(Buffer.from(input.xlsxBase64, "base64")));
    }
    return parseCsv(input.csv!);
  } catch (error) {
    if (error instanceof CsvParseError) throw new InvalidRequestError(error.message);
    throw error;
  }
}

// Resolves assignee names against workspace members. Import files carry
// names or emails, never our user ids — and an unmatched name must not
// silently attach the task to nobody-in-particular, so it's reported.
async function resolveAssignees(organizationId: string, names: string[]) {
  if (names.length === 0) return new Map<string, string>();

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId));

  const byKey = new Map<string, string>();
  for (const member of members) {
    byKey.set(member.name.toLowerCase(), member.id);
    byKey.set(member.email.toLowerCase(), member.id);
  }
  return byKey;
}

export const importRouter = router({
  // Reads the header row and guesses a mapping. Writes nothing.
  inspect: protectedProcedure
    .input(fileInput)
    .mutation(async ({ input }) => {
      const parsed = parseOrThrow(input);
      return {
        headers: parsed.headers,
        rowCount: parsed.rows.length,
        sample: parsed.rows.slice(0, 5),
        suggestedMapping: suggestMapping(parsed.headers),
        maxRows: MAX_IMPORT_ROWS,
      };
    }),

  // Full dry run: exactly what commit would write, plus every problem it
  // would report, with nothing persisted. This is the whole point of the
  // two-step flow — a spreadsheet import that half-succeeds is far worse
  // than one that refuses to start.
  preview: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid(),
          mapping: mappingSchema,
        })
        .and(fileInput)
    )
    .mutation(async ({ ctx, input }) => {
      await ownProject(ctx.organizationId, input.projectId);
      const parsed = parseOrThrow(input);
      const { rows, problems } = mapRowsToTasks(parsed, input.mapping);

      const names = [...new Set(rows.flatMap((r) => (r.assigneeName ? [r.assigneeName] : [])))];
      const byKey = await resolveAssignees(ctx.organizationId, names);
      const unmatched = names.filter((name) => !byKey.has(name.toLowerCase()));

      return {
        willCreate: rows.length,
        problems,
        unmatchedAssignees: unmatched,
        preview: rows.slice(0, 20),
      };
    }),

  commit: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid(),
          mapping: mappingSchema,
        })
        .and(fileInput)
    )
    .mutation(async ({ ctx, input }) => {
      await ownProject(ctx.organizationId, input.projectId);
      const parsed = parseOrThrow(input);
      const { rows, problems } = mapRowsToTasks(parsed, input.mapping);

      if (rows.length === 0) {
        throw new InvalidRequestError("Nothing to import — no rows had a usable title.");
      }

      const names = [...new Set(rows.flatMap((r) => (r.assigneeName ? [r.assigneeName] : [])))];
      const byKey = await resolveAssignees(ctx.organizationId, names);

      // One transaction and one multi-row insert: an import either lands
      // completely or not at all, and 5,000 rows don't become 5,000 round
      // trips. This is the one place that doesn't go through the mutation
      // catalog's per-row createTask — the org scoping it enforces is
      // applied here directly (organizationId and projectId are fixed for
      // every row, and the project was already checked above).
      const created = await db.transaction(async (tx) => {
        return tx
          .insert(tasks)
          .values(
            rows.map((row) => ({
              organizationId: ctx.organizationId,
              projectId: input.projectId,
              title: row.title,
              description: row.description,
              status: row.status,
              priority: row.priority,
              dueDate: row.dueDate,
              points: row.points,
              assigneeId: row.assigneeName
                ? (byKey.get(row.assigneeName.toLowerCase()) ?? null)
                : null,
              createdBy: ctx.userId,
            }))
          )
          .returning({ id: tasks.id });
      });

      return { imported: created.length, problems };
    }),
});
