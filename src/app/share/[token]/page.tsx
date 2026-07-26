import Link from "next/link";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { Globe } from "lucide-react";
import { db } from "@/server/db/client";
import { views, viewVersions } from "@/server/db/schema";
import { parseView } from "@/lib/dsl/validate";
import { preloadViewQueries } from "@/server/export/preload";
import { SharedViewDocument } from "@/components/views/shared-view-document";

// Public, read-only rendering of a shared view. Authorization is the token
// itself: unguessable, view-specific, revocable. Every query still runs
// server-side scoped to the view's own organization — the visitor gets a
// snapshot of exactly what the owner shared, and no way to query anything
// else.
export default async function SharedViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const notFound = (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-sm font-medium">This share link is invalid or has been revoked.</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Ask the person who sent it for a fresh link.
      </p>
    </main>
  );

  const view = await db.query.views.findFirst({ where: eq(views.shareToken, token) });
  if (!view?.currentVersionId) return notFound;

  const version = await db.query.viewVersions.findFirst({
    where: eq(viewVersions.id, view.currentVersionId),
  });
  if (!version) return notFound;

  const parsed = parseView(version.schemaJson);
  if (!parsed.success) return notFound;

  // Filter bars need live re-querying to mean anything, and this page has no
  // session to query with — so a shared view renders its unfiltered state
  // and the bars themselves are dropped.
  const schema = {
    ...parsed.data,
    widgets: parsed.data.widgets.filter((w) => w.type !== "filterBar" && w.type !== "form"),
  };
  if (schema.widgets.length === 0) return notFound;

  const preloaded = await preloadViewQueries(view.organizationId, schema, {});

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-1.5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Globe className="size-3.5" />
          Shared read-only view ·{" "}
          <Link href="/" className="text-foreground hover:underline">
            made with Clay
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{view.name}</h1>
        {version.promptText && (
          <p className="text-muted-foreground text-sm italic">&ldquo;{version.promptText}&rdquo;</p>
        )}
        <p className="text-muted-foreground text-xs">
          Data as of {format(new Date(), "PPp")}
        </p>
      </header>
      <SharedViewDocument schema={schema} preloaded={preloaded} />
    </main>
  );
}
