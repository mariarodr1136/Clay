"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useAgentStream } from "@/lib/use-agent-stream";
import { followUpSuggestions } from "@/lib/follow-up-suggestions";
import { useByokKey, useByokModel } from "@/lib/use-byok-key";
import { TranscriptList } from "@/components/agent/transcript-list";
import { ModelPicker } from "@/components/agent/model-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ViewChatPanel({ viewId, onUpdated }: { viewId: string; onUpdated: () => void }) {
  const [apiKey, setApiKey] = useByokKey();
  const [model, setModel] = useByokModel();
  const [message, setMessage] = useState("");
  const { transcript, isRunning, send } = useAgentStream();

  async function handleSend() {
    if (!apiKey.trim()) {
      toast.error("Enter your own Anthropic API key to use live mode.");
      return;
    }
    if (!message.trim()) return;

    const resultViewId = await send({ message: message.trim(), viewId, model }, apiKey.trim());
    setMessage("");
    if (resultViewId) onUpdated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="text-muted-foreground size-4" />
          Refine with AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Uses your own Anthropic API key — held only in this browser tab, sent per-request, never
          stored on our server.
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <ModelPicker value={model} onChange={setModel} className="w-36 shrink-0" />
        </div>
        <Textarea
          rows={2}
          placeholder='e.g. "make the chart bigger" or "add a filter for priority"'
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {followUpSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setMessage(suggestion)}
              className="border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <Button onClick={handleSend} disabled={isRunning || !message.trim()} size="sm">
          {isRunning ? "Updating…" : "Send"}
        </Button>
        <TranscriptList items={transcript} onSuggest={setMessage} />
      </CardContent>
    </Card>
  );
}
