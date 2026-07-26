// The models the BYOK chat may run. Allow-listed here (and re-validated
// server-side) so the client can never point the loop at an arbitrary model
// string. Shared by the API route's schema and the model picker UI.
export const agentModels = [
  { id: "claude-sonnet-5", label: "Sonnet 5", hint: "fast, capable — the default" },
  { id: "claude-opus-5", label: "Opus 5", hint: "strongest reasoning" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", hint: "cheapest, quickest" },
] as const;

export type AgentModelId = (typeof agentModels)[number]["id"];

export const DEFAULT_AGENT_MODEL: AgentModelId = "claude-sonnet-5";

export const agentModelIds = agentModels.map((m) => m.id) as [AgentModelId, ...AgentModelId[]];
