"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentEvent } from "@/server/agent/loop";
import { buildDemoViews } from "@/fixtures/demo-views";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BYOK_STORAGE_KEY = "selfsoftware_byok_anthropic_key";

// Display-only: buildDemoViews's schema depends on projectId, but name/prompt
// don't, so a placeholder id is fine here — we only read those two fields.
const EXAMPLE_FIXTURES = buildDemoViews("").map((f) => ({ name: f.name, prompt: f.prompt }));

type TranscriptItem =
  | { kind: "text"; text: string }
  | { kind: "status"; text: string; ok: boolean }
  | { kind: "view"; viewId: string; name: string }
  | { kind: "error"; text: string };

export default function ChatPage() {
  const projectsQuery = trpc.projects.list.useQuery();
  const viewsQuery = trpc.views.list.useQuery();

  const [projectId, setProjectId] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setApiKey(sessionStorage.getItem(BYOK_STORAGE_KEY) ?? "");
  }, []);

  useEffect(() => {
    if (!projectId && projectsQuery.data && projectsQuery.data.length > 0) {
      setProjectId(projectsQuery.data[0].id);
    }
  }, [projectId, projectsQuery.data]);

  const exampleViews = useMemo(() => {
    if (!viewsQuery.data) return [];
    return EXAMPLE_FIXTURES.map((fixture) => ({
      ...fixture,
      view: viewsQuery.data.find((v) => v.name === fixture.name),
    }));
  }, [viewsQuery.data]);

  function updateApiKey(value: string) {
    setApiKey(value);
    sessionStorage.setItem(BYOK_STORAGE_KEY, value);
  }

  async function handleGenerate() {
    if (!apiKey.trim()) {
      toast.error("Enter your own Anthropic API key to use live mode.");
      return;
    }
    if (!projectId) {
      toast.error("No project selected.");
      return;
    }
    if (!message.trim()) return;

    setIsRunning(true);
    setTranscript([]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Anthropic-Api-Key": apiKey.trim() },
        body: JSON.stringify({ message: message.trim(), projectId }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setTranscript((prev) => [...prev, { kind: "error", text: data.error ?? "Request failed" }]);
        return;
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
          applyEvent(event);
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
  }

  function applyEvent(event: AgentEvent) {
    setTranscript((prev) => {
      switch (event.type) {
        case "text":
          return [...prev, { kind: "text", text: event.text }];
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
        default:
          return prev;
      }
    });
    if (event.type === "done") {
      viewsQuery.refetch();
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ask for a view</h1>
        <p className="text-muted-foreground text-sm">
          Describe a dashboard you want and it gets built against your real task data.
        </p>
      </div>

      <Tabs defaultValue="examples">
        <TabsList>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="live">Live (bring your own key)</TabsTrigger>
        </TabsList>

        <TabsContent value="examples" className="space-y-3 pt-4">
          <p className="text-muted-foreground text-sm">
            Pre-generated — free, instant, no API key needed.
          </p>
          {exampleViews.map((fixture) => (
            <Card key={fixture.name}>
              <CardHeader>
                <CardTitle className="text-base">&ldquo;{fixture.prompt}&rdquo;</CardTitle>
              </CardHeader>
              <CardContent>
                {fixture.view ? (
                  <Button asChild size="sm">
                    <Link href={`/views/${fixture.view.id}`}>View result</Link>
                  </Button>
                ) : (
                  <p className="text-muted-foreground text-sm">Not available yet.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="live" className="space-y-4 pt-4">
          <p className="text-muted-foreground text-sm">
            Type any request. Uses your own Anthropic API key — held only in this browser tab, sent
            per-request, never stored on our server.
          </p>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => updateApiKey(e.target.value)}
            />
          </div>

          {projectsQuery.data && projectsQuery.data.length > 1 && (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projectsQuery.data.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Textarea
            rows={3}
            placeholder='e.g. "show me tasks by status as a bar chart"'
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <Button onClick={handleGenerate} disabled={isRunning || !message.trim()}>
            {isRunning ? "Generating…" : "Generate"}
          </Button>

          {transcript.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              {transcript.map((item, i) => {
                if (item.kind === "text") {
                  return (
                    <p key={i} className="text-sm">
                      {item.text}
                    </p>
                  );
                }
                if (item.kind === "status") {
                  return (
                    <p key={i} className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Badge variant={item.ok ? "outline" : "destructive"}>
                        {item.ok ? "ok" : "error"}
                      </Badge>
                      {item.text}
                    </p>
                  );
                }
                if (item.kind === "view") {
                  return (
                    <Card key={i}>
                      <CardContent className="flex items-center justify-between py-3">
                        <span className="text-sm font-medium">{item.name}</span>
                        <Button asChild size="sm">
                          <Link href={`/views/${item.viewId}`}>View result</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }
                return (
                  <p key={i} className="text-destructive text-sm">
                    {item.text}
                  </p>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
