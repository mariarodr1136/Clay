import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  emptyInputSchema,
  runQueryInputSchema,
  getViewInputSchema,
  proposeViewInputSchema,
} from "./tools/schemas";
import { executeTool } from "./execute-tool";

const MODEL = "claude-sonnet-5";
const MAX_ROUNDS = 6;
const MAX_TOKENS = 4096;

function toToolSchema(schema: z.ZodTypeAny): Anthropic.Tool.InputSchema {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
}

const tools: Anthropic.Tool[] = [
  {
    name: "describe_entities",
    description:
      "Describe the substrate data model (projects, tasks) available to build views over.",
    input_schema: toToolSchema(emptyInputSchema),
  },
  {
    name: "list_query_catalog",
    description:
      "List the allow-listed, org-scoped queries available for widgets to bind to. Call this before propose_view unless you already know the exact query ids you need.",
    input_schema: toToolSchema(emptyInputSchema),
  },
  {
    name: "run_query",
    description:
      "Run one query catalog entry with given params and inspect the real result — useful to sanity-check data (e.g. actual status values) before proposing a view.",
    input_schema: toToolSchema(runQueryInputSchema),
  },
  {
    name: "get_view",
    description: "Fetch an existing view's current schema, e.g. to refine it on a follow-up request.",
    input_schema: toToolSchema(getViewInputSchema),
  },
  {
    name: "propose_view",
    description:
      "Create a new view (a small dashboard of widgets bound to catalog queries) for the user. This is how you answer their request — call it exactly once, as your final action.",
    input_schema: toToolSchema(proposeViewInputSchema),
  },
];

function systemPrompt(projectId: string) {
  return `You are the agent behind SelfSoftware's "ask your interface into existence" feature — a project/task tracker where users describe a view in natural language and you build it against their real data.

The signed-in user is looking at project ${projectId} and just asked you for a view: a small dashboard of widgets answering their request.

Widgets are declarative, never code: table, kpi, chart, filterBar, text, form, computedField. A data-bound widget's dataBinding is { queryId, params } where queryId must be one of the query catalog's ids — you never write SQL or generate arbitrary code, only select and parameterize existing safe queries. Chart widgets support chartType "bar" or "line" only.

Call list_query_catalog first if you don't already know the exact catalog ids and their params. Use run_query to sanity-check real data when it would help you pick better widget config (e.g. confirm actual status values). When a widget's data should be scoped to the project the user is looking at, set dataBinding.params.projectId to "${projectId}" — omit it to query across the whole organization instead.

Keep views focused: usually 1-4 widgets, laid out on a 12-column grid (x 0-11, y from 0, w/h in grid units). Every widget id used in "widgets" must also appear in "layout.widgets".

End by calling propose_view exactly once with your best answer — that call is what actually makes the new view appear for the user, so don't stop before making it unless the request is impossible to satisfy with the available catalog (in which case explain why in text instead).`;
}

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean; summary: string }
  | { type: "view_created"; viewId: string; name: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function runAgentLoop(params: {
  apiKey: string;
  organizationId: string;
  userId: string;
  projectId: string;
  message: string;
  emit: (event: AgentEvent) => void;
}) {
  const { apiKey, organizationId, userId, projectId, message, emit } = params;
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: message }];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(projectId),
        tools,
        messages,
      });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) {
          emit({ type: "text", text: block.text });
        }
      }

      messages.push({ role: "assistant", content: response.content });

      if (toolUseBlocks.length === 0) {
        emit({ type: "done" });
        return;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let createdView: { viewId: string; name: string } | null = null;

      for (const block of toolUseBlocks) {
        emit({ type: "tool_call", name: block.name, input: block.input });

        const result = await executeTool(block.name, block.input, {
          organizationId,
          ownerId: userId,
          promptText: message,
        });

        emit({ type: "tool_result", name: block.name, ok: result.ok, summary: result.summary });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.content,
          is_error: !result.ok,
        });

        if (block.name === "propose_view" && result.ok && result.viewId && result.name) {
          createdView = { viewId: result.viewId, name: result.name };
        }
      }

      messages.push({ role: "user", content: toolResults });

      if (createdView) {
        emit({ type: "view_created", viewId: createdView.viewId, name: createdView.name });
        emit({ type: "done" });
        return;
      }
    }

    emit({
      type: "error",
      message: "Reached the maximum number of tool calls without proposing a view.",
    });
  } catch (error) {
    emit({
      type: "error",
      message: error instanceof Error ? error.message : "Something went wrong talking to Claude.",
    });
  }
}
