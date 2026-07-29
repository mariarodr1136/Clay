// Deliberately no "server-only": this module is entrypointed from a plain
// Node CLI, not from a React Server Component, and that package throws
// outside Next's server graph.
import { runAgentLoop, type AgentEvent } from "@/server/agent/loop";
import { db } from "@/server/db/client";
import { organizations, memberships, users, views, viewVersions } from "@/server/db/schema";
import { seedSampleData } from "@/server/db/seed-sample-data";
import { eq } from "drizzle-orm";
import { createView } from "@/server/db/create-view";
import { evalCases, type EvalCase } from "./cases";
import { gradeCase, summarize, type EvalOutcome, type EvalResult } from "./grade";
import type { AgentModelId } from "@/lib/agent-models";
import { randomUUID } from "node:crypto";

// Runs the real agent loop against a real (throwaway) workspace and grades
// the result. Live only — it costs tokens, so it is never part of `npm test`;
// see evals.test.ts for the offline half that runs on every commit.
//
// The workspace is seeded with the same sample data the demo uses, so the
// catalog returns realistic shapes rather than empty arrays, which is what
// makes "did it pick a sensible chart" a meaningful question.

export type EvalRunOptions = {
  apiKey: string;
  model?: AgentModelId;
  only?: string[];
};

async function withScratchWorkspace<T>(
  fn: (ctx: { organizationId: string; userId: string; projectId: string }) => Promise<T>
): Promise<T> {
  const userId = `eval_${randomUUID()}`;
  const [org] = await db.insert(organizations).values({ name: "Eval Workspace" }).returning();
  await db.insert(users).values({
    id: userId,
    email: `${userId}@eval.invalid`,
    name: "Eval Runner",
  });
  await db
    .insert(memberships)
    .values({ organizationId: org.id, userId, role: "owner", isPersonal: true });

  try {
    const project = await seedSampleData(org.id, userId);
    return await fn({ organizationId: org.id, userId, projectId: project.id });
  } finally {
    await db.delete(organizations).where(eq(organizations.id, org.id));
    await db.delete(users).where(eq(users.id, userId));
  }
}

async function runOne(
  evalCase: EvalCase,
  options: EvalRunOptions,
  ctx: { organizationId: string; userId: string; projectId: string }
): Promise<EvalOutcome> {
  // A refinement case needs a view to refine, created up front so the run
  // exercises the same get_view → propose_view path a real follow-up does.
  let openViewId: string | undefined;
  if (evalCase.openView) {
    const { view } = await createView({
      organizationId: ctx.organizationId,
      ownerId: ctx.userId,
      name: evalCase.openView.name,
      schema: evalCase.openView,
      createdBy: "user",
    });
    openViewId = view.id;
  }

  let text = "";
  let createdViewId: string | null = null;

  const emit = (event: AgentEvent) => {
    if (event.type === "text_delta") text += event.text;
    if (event.type === "text") text += event.text;
    if (event.type === "view_created") createdViewId = event.viewId;
  };

  await runAgentLoop({
    apiKey: options.apiKey,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    projectId: openViewId ? undefined : ctx.projectId,
    viewId: openViewId,
    viewName: evalCase.openView?.name,
    message: evalCase.prompt,
    model: options.model,
    emit,
  });

  if (!createdViewId) {
    return { proposedView: false, schema: null, text };
  }

  const view = await db.query.views.findFirst({ where: eq(views.id, createdViewId) });
  const version = view?.currentVersionId
    ? await db.query.viewVersions.findFirst({ where: eq(viewVersions.id, view.currentVersionId) })
    : undefined;

  return { proposedView: true, schema: version?.schemaJson ?? null, text };
}

export async function runEvals(options: EvalRunOptions) {
  const cases = options.only
    ? evalCases.filter((evalCase) => options.only!.includes(evalCase.id))
    : evalCases;

  return withScratchWorkspace(async (ctx) => {
    const results: EvalResult[] = [];
    // Serial on purpose: the agent rate limiter is per user, and parallel
    // runs would measure the limiter rather than the model.
    for (const evalCase of cases) {
      const outcome = await runOne(evalCase, options, ctx);
      results.push(gradeCase(evalCase, outcome));
    }
    return { results, summary: summarize(results) };
  });
}
