"use client";

import { useState } from "react";
import { agentModelIds, DEFAULT_AGENT_MODEL, type AgentModelId } from "@/lib/agent-models";

const BYOK_STORAGE_KEY = "clay_byok_anthropic_key";

function readStoredKey() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(BYOK_STORAGE_KEY) ?? "";
}

// sessionStorage, never localStorage: the key should not outlive the tab.
export function useByokKey() {
  const [apiKey, setApiKeyState] = useState(readStoredKey);

  function setApiKey(value: string) {
    setApiKeyState(value);
    sessionStorage.setItem(BYOK_STORAGE_KEY, value);
  }

  return [apiKey, setApiKey] as const;
}

const MODEL_STORAGE_KEY = "clay_byok_model";

function readStoredModel(): AgentModelId {
  if (typeof window === "undefined") return DEFAULT_AGENT_MODEL;
  const stored = sessionStorage.getItem(MODEL_STORAGE_KEY);
  return agentModelIds.includes(stored as AgentModelId) ? (stored as AgentModelId) : DEFAULT_AGENT_MODEL;
}

// Which Claude model the BYOK chat runs — the user is paying, so they pick.
export function useByokModel() {
  const [model, setModelState] = useState<AgentModelId>(readStoredModel);

  function setModel(value: AgentModelId) {
    setModelState(value);
    sessionStorage.setItem(MODEL_STORAGE_KEY, value);
  }

  return [model, setModel] as const;
}
