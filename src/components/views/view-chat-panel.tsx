"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAgentStream } from "@/lib/use-agent-stream";
import { useByokKey } from "@/lib/use-byok-key";
import { TranscriptList } from "@/components/agent/transcript-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ViewChatPanel({ viewId, onUpdated }: { viewId: string; onUpdated: () => void }) {
  const [apiKey, setApiKey] = useByokKey();
  const [message, setMessage] = useState("");
  const { transcript, isRunning, send } = useAgentStream();

  async function handleSend() {
    if (!apiKey.trim()) {
      toast.error("Enter your own Anthropic API key to use live mode.");
      return;
    }
    if (!message.trim()) return;

    const resultViewId = await send({ message: message.trim(), viewId }, apiKey.trim());
    setMessage("");
    if (resultViewId) onUpdated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Refine with AI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Uses your own Anthropic API key — held only in this browser tab, sent per-request, never
          stored on our server.
        </p>
        <Input
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <Textarea
          rows={2}
          placeholder='e.g. "make the chart bigger" or "add a filter for priority"'
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button onClick={handleSend} disabled={isRunning || !message.trim()} size="sm">
          {isRunning ? "Updating…" : "Send"}
        </Button>
        <TranscriptList items={transcript} />
      </CardContent>
    </Card>
  );
}
