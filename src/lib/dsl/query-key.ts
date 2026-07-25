// A stable identity for "this query with these resolved params". Key order is
// sorted so the same binding always produces the same string.
//
// Shared by the export planner (to collapse widgets that share a binding into
// one dataset) and by the print pages (to hand each widget its preloaded rows
// without re-running the query in the browser).
export function stableQueryKey(queryId: string, params: Record<string, unknown>): string {
  const ordered = Object.keys(params)
    .sort()
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join("&");
  return `${queryId}?${ordered}`;
}
