"use client";

import { useState } from "react";

const BYOK_STORAGE_KEY = "selfsoftware_byok_anthropic_key";

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
