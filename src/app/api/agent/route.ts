import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { ensureUserOrg } from "@/server/auth/ensure-user-org";
import { db } from "@/server/db/client";
import { projects, views } from "@/server/db/schema";
import { runAgentLoop, type AgentEvent } from "@/server/agent/loop";
import { checkRateLimit } from "@/server/agent/rate-limit";

const bodySchema = z
  .object({
    message: z.string().min(1).max(2000),
    projectId: z.string().uuid().optional(),
    viewId: z.string().uuid().optional(),
  })
  .refine((body) => body.projectId || body.viewId, {
    message: "Either projectId (new view) or viewId (refine an existing view) is required",
  });

export async function POST(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(clerkUserId);
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

  const { organizationId, userId } = await ensureUserOrg();
  const { message, projectId, viewId } = parsed.data;

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
      where: and(eq(views.id, viewId), eq(views.organizationId, organizationId)),
    });
    if (!view) {
      return Response.json({ error: "View not found" }, { status: 404 });
    }
    viewName = view.name;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await runAgentLoop({
          apiKey,
          organizationId,
          userId,
          projectId,
          viewId,
          viewName,
          message,
          emit,
        });
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
