"use client";

import { trpc } from "@/lib/trpc/client";
import { resolveBindingParams } from "@/lib/dsl/resolve-params";
import { stableQueryKey } from "@/lib/dsl/query-key";
import type { DataBinding } from "@/lib/dsl/schema";
import { usePreloadedQueries } from "./preloaded-data";

export type CatalogQueryResult = {
  data: Record<string, unknown>[] | undefined;
  isLoading: boolean;
  error: { message: string } | null;
};

export function useCatalogQuery(
  dataBinding: DataBinding,
  filters: Record<string, string>
): CatalogQueryResult {
  const preloaded = usePreloadedQueries();
  const params = resolveBindingParams(dataBinding.params, filters);

  // Hooks can't be skipped, so the query is always declared and simply
  // disabled when rows were preloaded server-side (the print/PDF path).
  const query = trpc.views.runQuery.useQuery(
    { queryId: dataBinding.queryId, params },
    { enabled: preloaded === null }
  );

  if (preloaded) {
    return {
      data: preloaded[stableQueryKey(dataBinding.queryId, params)] ?? [],
      isLoading: false,
      error: null,
    };
  }

  return {
    // Catalog queries always resolve to row arrays; the widgets narrow
    // further from here.
    data: query.data as Record<string, unknown>[] | undefined,
    isLoading: query.isLoading,
    error: query.error ? { message: query.error.message } : null,
  };
}
