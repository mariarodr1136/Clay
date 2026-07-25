// Row ceilings for the catalog's row-returning queries.
//
// Interactive callers — widgets and the agent — share INTERACTIVE_ROW_LIMIT:
// what a table can render, and what an agent can reason over, without janking
// the page or blowing a context window. runCatalogQuery clamps to it.
//
// Exports run the same queries through runCatalogQueryForExport, which raises
// the ceiling to EXPORT_ROW_LIMIT. A spreadsheet that silently stops at the
// widget's 50-row default is worse than no export at all, so exports go wide
// and report truncation explicitly when they still hit the cap.
export const DEFAULT_ROW_LIMIT = 50;
export const INTERACTIVE_ROW_LIMIT = 200;
export const EXPORT_ROW_LIMIT = 5000;
