"use client";

import { trpc } from "@/lib/trpc/client";
import type { DataBinding } from "@/lib/dsl/schema";

const filterRefPattern = /^\$filter:(.+)$/;

// A dataBinding param value of "$filter:status" is a live reference to the
// view's filterBar state, resolved here at query time. Unset filters simply
// omit the param, which every catalog query treats as "no filter."
function resolveParams(
  params: Record<string, string | number | boolean | null>,
  filters: Record<string, string>
) {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      const match = value.match(filterRefPattern);
      if (match) {
        const filterValue = filters[match[1]];
        if (filterValue) resolved[key] = filterValue;
        continue;
      }
    }
    resolved[key] = value;
  }
  return resolved;
}

export function useCatalogQuery(dataBinding: DataBinding, filters: Record<string, string>) {
  const params = resolveParams(dataBinding.params, filters);
  return trpc.views.runQuery.useQuery({ queryId: dataBinding.queryId, params });
}
