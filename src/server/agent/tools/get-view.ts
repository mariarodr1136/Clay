import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { views, viewVersions } from "@/server/db/schema";
import type { getViewInputSchema } from "./schemas";
import type { z } from "zod";

export async function getViewTool(
  organizationId: string,
  input: z.infer<typeof getViewInputSchema>
): Promise<{ ok: true; name: string; schema: unknown } | { ok: false; error: string }> {
  const view = await db.query.views.findFirst({
    where: and(eq(views.id, input.viewId), eq(views.organizationId, organizationId)),
  });
  if (!view || !view.currentVersionId) {
    return { ok: false, error: "View not found" };
  }

  const version = await db.query.viewVersions.findFirst({
    where: eq(viewVersions.id, view.currentVersionId),
  });
  if (!version) {
    return { ok: false, error: "View has no current version" };
  }

  return { ok: true, name: view.name, schema: version.schemaJson };
}
