"use client";

import { ViewRenderer } from "@/components/renderer/view-renderer";
import { PreloadedQueriesProvider, type PreloadedQueries } from "@/components/renderer/preloaded-data";

// A shared view for someone with no account: the same renderer as the app,
// fed rows that were resolved server-side under the owning organization's
// scope. Nothing here can query live — that's what makes it safe to be
// public.
export function SharedViewDocument({
  schema,
  preloaded,
}: {
  schema: unknown;
  preloaded: PreloadedQueries;
}) {
  return (
    <PreloadedQueriesProvider value={preloaded}>
      <ViewRenderer schema={schema} />
    </PreloadedQueriesProvider>
  );
}
