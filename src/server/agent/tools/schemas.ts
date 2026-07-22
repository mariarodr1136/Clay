import { z } from "zod";
import { viewSchema } from "@/lib/dsl/schema";

export const emptyInputSchema = z.object({});

export const runQueryInputSchema = z.object({
  queryId: z.string().describe("One of the ids returned by list_query_catalog"),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({})
    .describe("Parameters for the chosen query, per its param schema"),
});

export const getViewInputSchema = z.object({
  viewId: z.string().uuid().describe("The id of a view previously created in this organization"),
});

export const proposeViewInputSchema = z.object({
  name: z.string().min(1).max(200).describe("A short, human-readable name for this view"),
  schema: viewSchema.describe("The full View DSL: layout + widgets"),
});
