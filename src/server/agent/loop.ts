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

function systemPrompt(ctx: { projectId?: string; viewId?: string; viewName?: string }) {
  const contextBlock = ctx.viewId
    ? `The signed-in user has an existing view open — "${ctx.viewName}" (id: ${ctx.viewId}) — and just asked you for a change to it (e.g. "make this chart bigger," "add a filter"). Call get_view with viewId "${ctx.viewId}" first to see its current widgets and layout, then call propose_view with your revised full schema (widgets you don't want to change should be carried over unchanged, not dropped). Your propose_view call always patches this same view as a new version — you cannot create a separate new view in this conversation.`
    : `The signed-in user is looking at project ${ctx.projectId} and just asked you for a new view: a small dashboard of widgets answering their request. When a widget's data should be scoped to that project, set dataBinding.params.projectId to "${ctx.projectId}" — omit it to query across the whole organization instead.`;

  return `You are the agent behind Clay's "ask your interface into existence" feature — a project/task tracker where users describe a view in natural language and you build it against their real data.

${contextBlock}

Widgets are declarative, never code: table, kpi, chart, filterBar, text, form, computedField, progress. A data-bound widget's dataBinding is { queryId, params } where queryId must be one of the query catalog's ids — you never write SQL or generate arbitrary code, only select and parameterize existing safe queries.

Widget capabilities:
- chart: chartType "bar" | "line" | "area" | "stackedBar" | "stackedArea" | "donut". Cartesian charts need xField plus either yField (single series) or a series array [{ key, label, colorVar?, dashed? }] (max 5) where each key is a numeric field on the query's rows — use series for stacked/multi-line charts, and dashed: true for reference series (planned, ideal). colorVar accepts design tokens: "--chart-1" … "--chart-5" for ordinary series (assign in that order), or the semantic status tokens "--status-todo" / "--status-in-progress" / "--status-in-review" / "--status-done" when the series ARE task statuses. Donut charts use config.donut { nameField, valueField, centerLabel? } instead of x/y.
- kpi: a single aggregated figure (aggregate "count" | "sum" | "avg" over the rows, optional field). Optional note (short caption under the value) and intent "danger" for figures like overdue counts where non-zero is bad.
- table: columns may carry kind "status" | "priority" | "date" | "number" to render badges, overdue-highlighted dates, and right-aligned numbers.
- progress: labeled 0-100 meters, one per row ({ nameField, valueField }).
- filterBar: config { filterKey, label, options }; other widgets reference the live selection with a param value of "$filter:<filterKey>" (e.g. params.projectId = "$filter:project").

Call list_query_catalog if you don't already know the exact catalog ids and their params. Use run_query to sanity-check real data when it would help you pick better widget config (e.g. confirm actual status values or row field names).

Layout is a 12-column grid (x 0-11, y from 0, w/h in grid units; one row unit ≈ 100px). Every widget id used in "widgets" must also appear in "layout.widgets". Match scope to the request: a quick question deserves 1-3 widgets; a dashboard request deserves a composed layout — typically a row of 3-4 KPIs (w:3, h:2), then charts (h:3, w:5-12), then a detail table. Give charts breathing room; never make a chart narrower than w:5.

End by calling propose_view exactly once with your best answer — that call is what actually makes the change appear for the user, so don't stop before making it unless the request is impossible to satisfy with the available catalog (in which case explain why in text instead).`;
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
  projectId?: string;
  viewId?: string;
  viewName?: string;
  message: string;
  emit: (event: AgentEvent) => void;
}) {
  const { apiKey, organizationId, userId, projectId, viewId, viewName, message, emit } = params;
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: message }];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt({ projectId, viewId, viewName }),
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
          viewId,
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
