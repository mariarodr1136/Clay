import "server-only";
import { z } from "zod";
import {
  listQueryCatalog,
  queryCatalog,
  runCatalogQuery,
  type QueryCatalogKey,
} from "@/server/data-access/catalog";
import { describeEntities } from "@/server/agent/tools/describe-entities";
import { InvalidRequestError } from "@/server/errors";

// A stateless Model Context Protocol server over the query catalog.
//
// The catalog was already the right shape for this: an allow-listed, org
// scoped, Zod-validated set of read-only queries that the app's own agent is
// restricted to. Exposing it over MCP means an external assistant gets
// exactly the same surface — no SQL, no wider access, no new authorization
// story to reason about.
//
// Deliberately read-only. The mutation catalog is not exposed: writes in
// Clay happen when a signed-in person clicks, and a bearer token held by
// some other agent is not that.
//
// "Stateless" means no session negotiation and no server-initiated
// messages — every request is a self-contained JSON-RPC call. That is the
// subset MCP clients need for a plain tool server, and it maps cleanly onto
// a serverless route handler with no connection to keep alive.

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

const RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

function result(id: JsonRpcId, value: unknown) {
  return { jsonrpc: "2.0" as const, id, result: value };
}

function failure(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

// Tool results are content blocks; a structured payload travels as JSON text
// so a client can both show it and parse it.
function toolText(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    isError,
  };
}

function toolDefinitions() {
  const catalogIds = Object.keys(queryCatalog);
  return [
    {
      name: "describe_entities",
      description:
        "Describe the data model available in this Clay workspace (projects, tasks and their fields).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_queries",
      description:
        "List the allow-listed queries available over this workspace's project and task data, with what each returns.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "run_query",
      description:
        "Run one allow-listed query against this workspace and return its rows. Call list_queries first if you don't already know the query id and its parameters.",
      inputSchema: {
        type: "object",
        properties: {
          queryId: {
            type: "string",
            enum: catalogIds,
            description: "Which catalog query to run.",
          },
          params: {
            type: "object",
            description: "Parameters for the query; see list_queries for what each accepts.",
            additionalProperties: true,
          },
        },
        required: ["queryId"],
        additionalProperties: false,
      },
    },
  ];
}

const callParams = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

const runQueryArgs = z.object({
  queryId: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});

async function callTool(organizationId: string, rawParams: unknown) {
  const parsed = callParams.safeParse(rawParams ?? {});
  if (!parsed.success) {
    return toolText({ error: "Malformed tools/call parameters." }, true);
  }

  const { name, arguments: args } = parsed.data;

  if (name === "describe_entities") {
    return toolText(describeEntities());
  }

  if (name === "list_queries") {
    return toolText(listQueryCatalog());
  }

  if (name === "run_query") {
    const input = runQueryArgs.safeParse(args ?? {});
    if (!input.success) {
      return toolText({ error: input.error.issues.map((i) => i.message).join("; ") }, true);
    }
    if (!(input.data.queryId in queryCatalog)) {
      return toolText(
        {
          error: `Unknown query id "${input.data.queryId}".`,
          available: Object.keys(queryCatalog),
        },
        true
      );
    }

    try {
      // organizationId comes from the token, never from the caller's
      // arguments — the same invariant the in-app agent runs under.
      const rows = await runCatalogQuery(
        organizationId,
        input.data.queryId as QueryCatalogKey,
        input.data.params
      );
      return toolText(rows);
    } catch (error) {
      // A bad parameter is the caller's problem to fix, so it comes back as
      // a tool error they can read rather than a transport failure.
      const message =
        error instanceof InvalidRequestError || error instanceof Error
          ? error.message
          : "Query failed.";
      return toolText({ error: message }, true);
    }
  }

  return toolText({ error: `Unknown tool "${name}".` }, true);
}

// Returns null for notifications, which by JSON-RPC take no response.
export async function handleMcpRequest(
  organizationId: string,
  request: JsonRpcRequest
): Promise<object | null> {
  const id = request.id ?? null;

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return failure(id, RPC_ERRORS.invalidRequest, "Not a JSON-RPC 2.0 request.");
  }

  // Notifications ("notifications/initialized" and friends) are
  // acknowledged by silence.
  if (request.method.startsWith("notifications/")) return null;

  switch (request.method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "clay", version: "1.0.0" },
        instructions:
          "Read-only access to one Clay workspace's projects and tasks through an allow-listed query catalog. Start with list_queries.",
      });

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, { tools: toolDefinitions() });

    case "tools/call":
      return result(id, await callTool(organizationId, request.params));

    default:
      return failure(id, RPC_ERRORS.methodNotFound, `Unknown method "${request.method}".`);
  }
}

export const MCP_RPC_ERRORS = RPC_ERRORS;
