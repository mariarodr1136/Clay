import { and, eq, isNull, type SQL } from "drizzle-orm";
import { views } from "./schema";

// Every read path that resolves a view by id shares this predicate, so a
// trashed view disappears from the gallery, the agent's get_view tool, the
// export routes, and any live share link at the same moment — without each
// call site having to remember the deletedAt check independently.
export function activeView(viewId: string, organizationId: string): SQL | undefined {
  return and(
    eq(views.id, viewId),
    eq(views.organizationId, organizationId),
    isNull(views.deletedAt)
  );
}

// Org-wide "not trashed" filter, for the list/feed queries that aren't
// resolving a single id.
export function activeViewsInOrg(organizationId: string): SQL | undefined {
  return and(eq(views.organizationId, organizationId), isNull(views.deletedAt));
}
