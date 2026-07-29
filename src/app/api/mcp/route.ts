import { bearerFrom, verifyApiToken } from "@/server/auth/api-token";
import { checkRateLimit } from "@/server/agent/rate-limit";
import { handleMcpRequest, MCP_RPC_ERRORS, type JsonRpcRequest } from "@/server/mcp/handler";

// Model Context Protocol endpoint. Point an MCP client at
// https://<deployment>/api/mcp with an `Authorization: Bearer clay_...`
// header and it gets read-only access to exactly one workspace.
//
// Authorization is the token and nothing else — no cookie, no Clerk session.
// The token names one organization, frozen at creation, and every query runs
// scoped to it.

const MCP_RATE_LIMIT = { windowMs: 60_000, max: 120 };

function rpcError(code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const identity = await verifyApiToken(bearerFrom(request));
  if (!identity) {
    // 401 with a WWW-Authenticate header, so a client can tell "your token
    // is wrong" apart from "that method doesn't exist".
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: MCP_RPC_ERRORS.invalidRequest, message: "Invalid or missing API token." } },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="clay"' } }
    );
  }

  // Per token, not per IP: one noisy agent shouldn't be able to exhaust a
  // budget shared with its colleagues.
  const rate = await checkRateLimit(`mcp:${identity.tokenId}`, MCP_RATE_LIMIT);
  if (!rate.ok) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: MCP_RPC_ERRORS.internal, message: "Rate limit exceeded." } },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(MCP_RPC_ERRORS.parse, "Request body is not valid JSON.", 400);
  }

  // JSON-RPC allows a batch; MCP clients mostly send one message, but
  // handling both is a few lines and avoids a confusing failure.
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((message) => handleMcpRequest(identity.organizationId, message as JsonRpcRequest))
    );
    const answered = responses.filter((response) => response !== null);
    // An all-notification batch gets no body at all, per spec.
    return answered.length === 0
      ? new Response(null, { status: 202 })
      : Response.json(answered);
  }

  if (!body || typeof body !== "object") {
    return rpcError(MCP_RPC_ERRORS.invalidRequest, "Request body must be a JSON-RPC object.", 400);
  }

  const response = await handleMcpRequest(identity.organizationId, body as JsonRpcRequest);
  return response === null ? new Response(null, { status: 202 }) : Response.json(response);
}

// Some clients probe with GET before opening a stream. This server is
// stateless and has nothing to stream, so it says so rather than hanging.
export function GET() {
  return Response.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: MCP_RPC_ERRORS.methodNotFound,
        message: "This MCP server is stateless — send JSON-RPC over POST.",
      },
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
