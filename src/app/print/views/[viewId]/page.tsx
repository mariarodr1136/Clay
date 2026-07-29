import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/server/db/client";
import { viewVersions } from "@/server/db/schema";
import { activeView } from "@/server/db/view-access";
import { parseView } from "@/lib/dsl/validate";
import { verifyPrintToken } from "@/server/export/print-token";
import { preloadViewQueries } from "@/server/export/preload";
import { PrintDocument } from "@/components/renderer/print-document";

// Reached only by the PDF renderer's headless browser, which has no Clerk
// session — so this page authorizes on the signed token alone and scopes
// every query to the organization named inside it. An absent, tampered, or
// expired token renders nothing.
export default async function PrintViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ viewId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { viewId } = await params;
  const { token } = await searchParams;

  const payload = verifyPrintToken(token);
  if (!payload || payload.viewId !== viewId) {
    return <p className="text-destructive text-sm">This print link is invalid or has expired.</p>;
  }

  const view = await db.query.views.findFirst({
    where: activeView(viewId, payload.organizationId),
  });
  if (!view?.currentVersionId) {
    return <p className="text-destructive text-sm">View not found.</p>;
  }

  const version = await db.query.viewVersions.findFirst({
    where: eq(viewVersions.id, view.currentVersionId),
  });
  if (!version) {
    return <p className="text-destructive text-sm">View has no current version.</p>;
  }

  const parsed = parseView(version.schemaJson);
  if (!parsed.success) {
    return <p className="text-destructive text-sm">View schema is invalid: {parsed.error}</p>;
  }

  const preloaded = await preloadViewQueries(payload.organizationId, parsed.data, payload.filters);

  return (
    <PrintDocument
      schema={version.schemaJson}
      preloaded={preloaded}
      header={{
        title: view.name,
        prompt: version.promptText,
        meta: `Version by ${version.createdBy}`,
        generatedAt: format(new Date(), "PPp"),
        filters: payload.filters,
      }}
    />
  );
}
