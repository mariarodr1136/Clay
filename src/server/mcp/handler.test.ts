import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects, tasks } from "@/server/db/schema";
import { handleMcpRequest } from "./handler";
import { generateApiToken, verifyApiToken } from "@/server/auth/api-token";
import { apiTokens } from "@/server/db/schema";

function textOf(response: unknown) {
  const result = (response as { result?: { content?: { text?: string }[]; isError?: boolean } })
    .result;
  return { text: result?.content?.[0]?.text ?? "", isError: result?.isError === true };
}

describe("MCP server", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "MCP Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "MCP Org B" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_mcp_user", email: "mcp@example.com", name: "MCP User" })
      .returning();

    const [projectA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "MCP Project A", createdBy: user.id })
      .returning();
    const [projectB] = await db
      .insert(projects)
      .values({ organizationId: orgB.id, name: "MCP Project B", createdBy: user.id })
      .returning();

    await db.insert(tasks).values([
      {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: "Visible to A",
        createdBy: user.id,
      },
      {
        organizationId: orgB.id,
        projectId: projectB.id,
        title: "SECRET_B_TASK",
        createdBy: user.id,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, user.id));
  });

  it("completes the initialize handshake", async () => {
    const response = (await handleMcpRequest(orgA.id, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    })) as { result: { protocolVersion: string; capabilities: object; serverInfo: object } };

    expect(response.result.protocolVersion).toBeTruthy();
    expect(response.result.capabilities).toHaveProperty("tools");
    expect(response.result.serverInfo).toHaveProperty("name", "clay");
  });

  it("advertises only read-only tools", async () => {
    const response = (await handleMcpRequest(orgA.id, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    })) as { result: { tools: { name: string }[] } };

    const names = response.result.tools.map((t) => t.name);
    expect(names).toEqual(["describe_entities", "list_queries", "run_query"]);
    // The mutation catalog must never be reachable through a bearer token:
    // writes in Clay happen when a signed-in person clicks.
    expect(names.join(" ")).not.toMatch(/create|update|delete|mutation/i);
  });

  it("runs a catalog query scoped to the token's organization", async () => {
    const response = await handleMcpRequest(orgA.id, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "run_query", arguments: { queryId: "tasksList", params: {} } },
    });

    const { text, isError } = textOf(response);
    expect(isError).toBe(false);
    expect(text).toContain("Visible to A");
    expect(text).not.toContain("SECRET_B_TASK");
  });

  it("cannot be pointed at another organization through its arguments", async () => {
    // organizationId comes from the token; nothing in the tool arguments
    // should be able to redirect it.
    const response = await handleMcpRequest(orgA.id, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "run_query",
        arguments: {
          queryId: "tasksList",
          params: { organizationId: orgB.id },
        },
      },
    });

    expect(textOf(response).text).not.toContain("SECRET_B_TASK");
  });

  it("reports an unknown query as a tool error, not a crash", async () => {
    const response = await handleMcpRequest(orgA.id, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "run_query", arguments: { queryId: "dropAllTables" } },
    });

    const { text, isError } = textOf(response);
    expect(isError).toBe(true);
    expect(text).toContain("Unknown query id");
  });

  it("rejects an unknown method", async () => {
    const response = (await handleMcpRequest(orgA.id, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/execute",
    })) as { error: { code: number } };
    expect(response.error.code).toBe(-32601);
  });

  it("answers notifications with silence", async () => {
    const response = await handleMcpRequest(orgA.id, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(response).toBeNull();
  });
});

describe("API tokens", () => {
  let org: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;

  beforeAll(async () => {
    [org] = await db.insert(organizations).values({ name: "Token Org" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_token_user", email: "tok@example.com", name: "Token User" })
      .returning();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, org.id));
    await db.delete(users).where(eq(users.id, user.id));
  });

  async function issue() {
    const { token, tokenHash, prefix } = generateApiToken();
    const [row] = await db
      .insert(apiTokens)
      .values({ organizationId: org.id, userId: user.id, name: "test", tokenHash, prefix })
      .returning();
    return { token, row };
  }

  it("resolves a valid token to its workspace", async () => {
    const { token } = await issue();
    const identity = await verifyApiToken(token);
    expect(identity?.organizationId).toBe(org.id);
    expect(identity?.userId).toBe(user.id);
  });

  it("stores only a hash — the raw token is not recoverable", async () => {
    const { token, row } = await issue();
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).not.toContain(token.slice(8));
    // The stored prefix is short enough to be useless on its own.
    expect(token.startsWith(row.prefix)).toBe(true);
    expect(row.prefix.length).toBeLessThan(token.length / 2);
  });

  it("refuses a revoked token", async () => {
    const { token, row } = await issue();
    await db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, row.id));
    expect(await verifyApiToken(token)).toBeNull();
  });

  it("refuses junk, a missing token, and a near-miss", async () => {
    const { token } = await issue();
    expect(await verifyApiToken(null)).toBeNull();
    expect(await verifyApiToken("")).toBeNull();
    expect(await verifyApiToken("not-a-clay-token")).toBeNull();
    // One character off must not match.
    expect(await verifyApiToken(`${token.slice(0, -1)}x`)).toBeNull();
  });
});
