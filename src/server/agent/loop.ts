import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  emptyInputSchema,
  runQueryInputSchema,
  getViewInputSchema,
  proposeViewInputSchema,
} from "./tools/schemas";
import { executeTool } from "./execute-tool";
import { DEFAULT_AGENT_MODEL, type AgentModelId } from "@/lib/agent-models";
import type { AgentRunOutcome } from "@/server/db/schema";

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
      "Create a new view (a small dashboard of widgets bound to catalog queries) for the user. This is how you build or change a view — call it at most once, as your final action.",
    input_schema: toToolSchema(proposeViewInputSchema),
    // The tool set is static across rounds and requests, so a cache
    // breakpoint on the last tool means every follow-up round (and every
    // later request from the same key) pays for the tool schemas once.
    cache_control: { type: "ephemeral" },
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
- table: columns may carry kind "status" | "priority" | "date" | "number" to render badges, overdue-highlighted dates, and right-aligned numbers. When the user wants to act from the view (a triage board, "let me update these here"), set config.statusActions: true on a table bound to a row-level task query (tasksList, overdueTasks, upcomingTasks) and include a status column — each row's status becomes a live dropdown. The mutation runs only when the signed-in user clicks, through the org-scoped mutation catalog; you cannot trigger it yourself.
- progress: labeled 0-100 meters, one per row ({ nameField, valueField }).
- filterBar: config { filterKey, label, options }; other widgets reference the live selection with a param value of "$filter:<filterKey>" (e.g. params.projectId = "$filter:project").

Call list_query_catalog if you don't already know the exact catalog ids and their params. Use run_query to sanity-check real data when it would help you pick better widget config (e.g. confirm actual status values or row field names).

Layout is a 12-column grid (x 0-11, y from 0, w/h in grid units; one row unit ≈ 100px). Every widget id used in "widgets" must also appear in "layout.widgets". Match scope to the request: a quick question deserves 1-3 widgets; a dashboard request deserves a composed layout — typically a row of 3-4 KPIs (w:3, h:2), then charts (h:3, w:5-12), then a detail table. Give charts breathing room; never make a chart narrower than w:5.

Two kinds of request, two endings:
- If the user wants a view built or changed, end by calling propose_view exactly once with your best answer — that call is what actually makes the change appear for the user, so don't stop before making it unless the request is impossible to satisfy with the available catalog (in which case explain why in text instead).
- If the user is asking a question about their data ("which project is most behind?", "who has the most overdue work?") rather than asking for a dashboard, don't force a view on them: use run_query to get the real numbers, then answer directly in text, citing the figures you found. Offer to build a view of it only if that would genuinely help.`;
}

// The subset of MessageParam this loop ever produces. MessageParam's role
// also admits "system", which the Messages API doesn't accept in the
// messages array — narrowing here keeps that impossible state out of the
// thread store.
export type AgentTurnMessage = {
  role: "user" | "assistant";
  content: Anthropic.MessageParam["content"];
};

// Everything the caller needs to persist the turn and record telemetry —
// returned rather than written here so the loop stays free of database
// concerns and the eval harness can run it without a thread.
export type AgentRunResult = {
  outcome: AgentRunOutcome;
  model: AgentModelId;
  rounds: number;
  toolCalls: number;
  toolErrors: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
  // The messages this run added, ready to append to the thread.
  turn: AgentTurnMessage[];
  viewId?: string;
  errorMessage?: string;
};

// Marks the end of the replayed history as a cache breakpoint, so a
// follow-up turn reads every earlier turn (and its tool rounds) from cache
// instead of re-paying for them. Only the last history block is marked —
// breakpoints are a limited resource, and the tool schemas and system
// prompt already hold the other two.
function withHistoryCacheBreakpoint(
  messages: Anthropic.MessageParam[],
  historyLength: number
): Anthropic.MessageParam[] {
  if (historyLength === 0) return messages;

  return messages.map((message, index) => {
    if (index !== historyLength - 1 || !Array.isArray(message.content)) return message;

    const blocks = [...message.content];
    const last = blocks[blocks.length - 1];
    // Only text and tool_result blocks accept cache_control; a turn ending
    // in anything else is left alone rather than risking an API rejection.
    if (!last || (last.type !== "text" && last.type !== "tool_result")) return message;

    blocks[blocks.length - 1] = { ...last, cache_control: { type: "ephemeral" } };
    return { ...message, content: blocks };
  });
}

export type AgentEvent =
  | { type: "text"; text: string }
  // Streamed fragment of the current text block — the client appends these
  // to the entry a preceding "text_start" opened.
  | { type: "text_start" }
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean; summary: string }
  | { type: "view_created"; viewId: string; name: string }
  // Emitted first on every run so a client that started without a thread id
  // learns the one to send with its next message.
  | { type: "thread_started"; threadId: string }
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
  model?: AgentModelId;
  // Prior turns of this conversation, oldest-first. Empty for a new thread.
  history?: Anthropic.MessageParam[];
  emit: (event: AgentEvent) => void;
}): Promise<AgentRunResult> {
  const { apiKey, organizationId, userId, projectId, viewId, viewName, message, emit } = params;
  const client = new Anthropic({ apiKey });
  const model = params.model ?? DEFAULT_AGENT_MODEL;
  const startedAt = Date.now();

  const history = params.history ?? [];
  const turn: AgentTurnMessage[] = [{ role: "user", content: message }];
  // History is replayed ahead of this turn but never re-persisted, so the
  // turn array stays exactly the delta this run appends to the thread.
  const messages: Anthropic.MessageParam[] = [...history, ...turn];

  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let toolCalls = 0;
  let toolErrors = 0;
  let roundsUsed = 0;
  let producedText = false;

  const finish = (
    outcome: AgentRunOutcome,
    extra: { viewId?: string; errorMessage?: string } = {}
  ): AgentRunResult => ({
    outcome,
    model,
    rounds: roundsUsed,
    toolCalls,
    toolErrors,
    ...usage,
    latencyMs: Date.now() - startedAt,
    turn,
    ...extra,
  });

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      roundsUsed = round + 1;
      const stream = client.messages.stream({
        model,
        max_tokens: MAX_TOKENS,
        // As with the tools' breakpoint: the system prompt is identical
        // across rounds, so later rounds read it from cache.
        system: [
          {
            type: "text",
            text: systemPrompt({ projectId, viewId, viewName }),
            cache_control: { type: "ephemeral" },
          },
        ],
        tools,
        messages: withHistoryCacheBreakpoint(messages, history.length),
      });

      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_start" && event.content_block.type === "text") {
          emit({ type: "text_start" });
        }
      });
      stream.on("text", (delta) => {
        emit({ type: "text_delta", text: delta });
      });

      const response = await stream.finalMessage();

      usage.inputTokens += response.usage.input_tokens ?? 0;
      usage.outputTokens += response.usage.output_tokens ?? 0;
      usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
      usage.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;

      if (response.content.some((block) => block.type === "text")) producedText = true;

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      messages.push({ role: "assistant", content: response.content });
      turn.push({ role: "assistant", content: response.content });

      if (toolUseBlocks.length === 0) {
        emit({ type: "done" });
        // No tool call and no view: the model answered the question in
        // prose, which is a legitimate ending, not a failure to build.
        return finish(producedText ? "answered" : "exhausted_rounds");
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let createdView: { viewId: string; name: string } | null = null;

      for (const block of toolUseBlocks) {
        toolCalls++;
        emit({ type: "tool_call", name: block.name, input: block.input });

        const result = await executeTool(block.name, block.input, {
          organizationId,
          ownerId: userId,
          promptText: message,
          viewId,
        });

        if (!result.ok) toolErrors++;
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
      turn.push({ role: "user", content: toolResults });

      if (createdView) {
        emit({ type: "view_created", viewId: createdView.viewId, name: createdView.name });
        emit({ type: "done" });
        return finish("view_created", { viewId: createdView.viewId });
      }
    }

    const exhausted = "Reached the maximum number of tool calls without proposing a view.";
    emit({ type: "error", message: exhausted });
    return finish("exhausted_rounds", { errorMessage: exhausted });
  } catch (error) {
    const message_ =
      error instanceof Error ? error.message : "Something went wrong talking to Claude.";
    emit({ type: "error", message: message_ });
    return finish("error", { errorMessage: message_ });
  }
}
