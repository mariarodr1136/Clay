import { viewSchema, type ViewInput } from "./schema";

export type ParseViewResult =
  | { success: true; data: ViewInput }
  | { success: false; error: string };

export function parseView(data: unknown): ParseViewResult {
  const result = viewSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.issues.map((i) => i.message).join("; ") };
}
