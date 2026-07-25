"use client";

import { createContext, useContext } from "react";

// Rows keyed by stableQueryKey(queryId, resolvedParams).
export type PreloadedQueries = Record<string, Record<string, unknown>[]>;

const PreloadedQueriesContext = createContext<PreloadedQueries | null>(null);

// Wraps the print pages, where there is no Clerk session and therefore no
// tRPC: a headless browser rendering a PDF gets its rows resolved on the
// server and handed to the widgets directly. Everywhere else this is absent
// and widgets fetch normally.
export function PreloadedQueriesProvider({
  value,
  children,
}: {
  value: PreloadedQueries;
  children: React.ReactNode;
}) {
  return (
    <PreloadedQueriesContext.Provider value={value}>{children}</PreloadedQueriesContext.Provider>
  );
}

export function usePreloadedQueries() {
  return useContext(PreloadedQueriesContext);
}
