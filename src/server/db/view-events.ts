import "server-only";
import { db } from "./client";
import { activityLog } from "./schema";

// View events that aren't content changes.
//
// view_versions records what a view *is* at each point. Publishing doesn't
// change the content, and a proposal the validator refused never became a
// version at all — but both are exactly what an audit log is for: the first
// changes who can see the data, and the second is the guardrail visibly
// doing its job.
//
// They ride on activity_log, which already exists for task history, rather
// than a fourth table. entityType tells the two apart.

export const VIEW_EVENT_VERBS = {
  published: "view.published",
  unpublished: "view.unpublished",
  blocked: "view.proposal_blocked",
} as const;

export type ViewEventVerb = (typeof VIEW_EVENT_VERBS)[keyof typeof VIEW_EVENT_VERBS];

export async function recordViewEvent(params: {
  organizationId: string;
  actorId: string;
  verb: ViewEventVerb;
  viewId: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityLog).values({
    organizationId: params.organizationId,
    actorId: params.actorId,
    verb: params.verb,
    entityType: "view",
    entityId: params.viewId,
    metadata: params.metadata ?? {},
  });
}
