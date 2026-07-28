import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { resolveActiveOrg } from "@/server/auth/resolve-org";
import { db } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import { activeView } from "@/server/db/view-access";
import { runAgentLoop, type AgentEvent } from "@/server/agent/loop";
import { checkRateLimit } from "@/server/agent/rate-limit";
import { appendTurn, loadThreadHistory, resolveThread } from "@/server/agent/threads";
import { recordAgentRun } from "@/server/agent/telemetry";
import { agentModelIds } from "@/lib/agent-models";

const bodySchema = z
  .object({
    message: z.string().min(1).max(2000),
    projectId: z.string().uuid().optional(),
    viewId: z.string().uuid().optional(),
    // Omitted on the first message of a conversation; the response's
    // thread_started event tells the client what to send from then on.
    threadId: z.string().uuid().optional(),
    // Allow-listed — an arbitrary model string never reaches the SDK.
    model: z.enum(agentModelIds).optional(),
  })
  .refine((body) => body.projectId || body.viewId, {
    message: "Either projectId (new view) or viewId (refine an existing view) is required",
  });

export async function POST(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(clerkUserId);
  if (!rateLimit.ok) {
    return Response.json(
      { error: `Too many requests — try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  // BYOK only — there is no owner key configured in this app to fall back
  // to, by design (see the plan's Cost & Demo Model).
  const apiKey = req.headers.get("x-anthropic-api-key");
  if (!apiKey) {
    return Response.json(
      { error: "Enter your own Anthropic API key to use live mode." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, {
      status: 400,
    });
  }

  const { organizationId, userId } = await resolveActiveOrg();
  const { message, projectId, viewId, model, threadId } = parsed.data;

  let viewName: string | undefined;

  if (projectId) {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
    });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
  }

  if (viewId) {
    const view = await db.query.views.findFirst({
      where: activeView(viewId, organizationId),
    });
    if (!view) {
      return Response.json({ error: "View not found" }, { status: 404 });
    }
    viewName = view.name;
  }

  // Resolved before the stream opens so a bad thread id fails as a clean
  // JSON error rather than mid-stream.
  let thread: Awaited<ReturnType<typeof resolveThread>>;
  try {
    thread = await resolveThread({
      threadId,
      organizationId,
      userId,
      projectId,
      viewId,
      message,
    });
  } catch {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const history = threadId ? await loadThreadHistory(thread.id) : [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        emit({ type: "thread_started", threadId: thread.id });

        const result = await runAgentLoop({
          apiKey,
          organizationId,
          userId,
          projectId,
          viewId,
          viewName,
          message,
          model,
          history,
          emit,
        });

        // Persistence happens after the stream has delivered everything, so
        // a slow write never delays the user's last token. Neither failure
        // is worth breaking the response over: the user already has their
        // answer, so a lost turn or lost telemetry row is logged and
        // swallowed rather than surfaced as an error.
        try {
          await appendTurn(thread.id, result.turn);
        } catch (error) {
          console.error("[agent] failed to persist conversation turn", error);
        }

        try {
          await recordAgentRun({
            organizationId,
            userId,
            threadId: thread.id,
            isRefinement: Boolean(viewId),
            result,
          });
        } catch (error) {
          console.error("[agent] failed to record run telemetry", error);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
