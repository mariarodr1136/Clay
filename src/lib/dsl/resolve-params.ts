const filterRefPattern = /^\$filter:(.+)$/;

// A dataBinding param value of "$filter:status" is a live reference to the
// view's filterBar state, resolved here at query time. Unset filters simply
// omit the param, which every catalog query treats as "no filter."
//
// Shared on purpose by all four callers — the renderer (client, per widget),
// the export path (server, per dataset), the demo's in-memory query catalog,
// and the demo export. A second copy would drift, and the failure mode is
// silent: "export" would quietly come to mean "export ignoring the filters
// on screen."
export function resolveBindingParams(
  params: Record<string, unknown>,
  filters: Record<string, string>
): Record<string, unknown> {
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
