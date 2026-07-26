"use client";

import { useState } from "react";
import type { AgentEvent } from "@/server/agent/loop";

export type TranscriptItem =
  | { kind: "text"; text: string }
  | { kind: "status"; text: string; ok: boolean }
  | { kind: "view"; viewId: string; name: string }
  | { kind: "error"; text: string };

function applyEvent(prev: TranscriptItem[], event: AgentEvent): TranscriptItem[] {
  switch (event.type) {
    case "text":
      return [...prev, { kind: "text", text: event.text }];
    // Streaming text: text_start opens a fresh entry, each delta appends to
    // it — so two separate text blocks in one turn stay two entries.
    case "text_start":
      return [...prev, { kind: "text", text: "" }];
    case "text_delta": {
      const last = prev[prev.length - 1];
      if (!last || last.kind !== "text") {
        return [...prev, { kind: "text", text: event.text }];
      }
      return [...prev.slice(0, -1), { kind: "text", text: last.text + event.text }];
    }
    case "tool_call":
      return [...prev, { kind: "status", text: `Calling ${event.name}…`, ok: true }];
    case "tool_result":
      return [...prev, { kind: "status", text: event.summary, ok: event.ok }];
    case "view_created":
      return [...prev, { kind: "view", viewId: event.viewId, name: event.name }];
    case "error":
      return [...prev, { kind: "error", text: event.message }];
    case "done":
      return prev;
  }
}

// Shared by the fresh-generation chat page and the view-scoped refine
// panel — both just POST /api/agent with a different body shape and read
// the same NDJSON event stream back.
export function useAgentStream() {
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  async function send(
    body: { message: string; projectId?: string; viewId?: string; model?: string },
    apiKey: string
  ): Promise<string | null> {
    setIsRunning(true);
    setTranscript([]);
    let resultViewId: string | null = null;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Anthropic-Api-Key": apiKey },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setTranscript((prev) => [...prev, { kind: "error", text: data.error ?? "Request failed" }]);
        return null;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AgentEvent;
          if (event.type === "view_created") resultViewId = event.viewId;
          setTranscript((prev) => applyEvent(prev, event));
        }
      }
    } catch (err) {
      setTranscript((prev) => [
        ...prev,
        { kind: "error", text: err instanceof Error ? err.message : "Something went wrong" },
      ]);
    } finally {
      setIsRunning(false);
    }

    return resultViewId;
  }

  return { transcript, isRunning, send };
}
