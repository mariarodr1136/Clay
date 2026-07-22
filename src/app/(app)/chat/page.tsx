"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, MessageSquareText, Sparkles } from "lucide-react";
import { buildDemoViews } from "@/fixtures/demo-views";
import { trpc } from "@/lib/trpc/client";
import { useAgentStream } from "@/lib/use-agent-stream";
import { useByokKey } from "@/lib/use-byok-key";
import { TranscriptList } from "@/components/agent/transcript-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Display-only: buildDemoViews's schema depends on projectId, but name/prompt
// don't, so a placeholder id is fine here — we only read those two fields.
const EXAMPLE_FIXTURES = buildDemoViews("").map((f) => ({ name: f.name, prompt: f.prompt }));

export default function ChatPage() {
  const projectsQuery = trpc.projects.list.useQuery();
  const viewsQuery = trpc.views.list.useQuery();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [apiKey, setApiKey] = useByokKey();
  const [message, setMessage] = useState("");
  const { transcript, isRunning, send } = useAgentStream();

  // Default to the first project until the user explicitly picks one —
  // computed from the query result rather than mirrored into state via an
  // effect (there's nothing to keep in sync once loaded).
  const projectId = selectedProjectId || projectsQuery.data?.[0]?.id || "";

  const exampleViews = useMemo(() => {
    if (!viewsQuery.data) return [];
    return EXAMPLE_FIXTURES.map((fixture) => ({
      ...fixture,
      view: viewsQuery.data.find((v) => v.name === fixture.name),
    }));
  }, [viewsQuery.data]);

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

    await send({ message: message.trim(), projectId }, apiKey.trim());
    viewsQuery.refetch();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent">
            <MessageSquareText className="size-4.5 text-accent-foreground" />
          </span>
          Ask for a view
        </h1>
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
                <CardTitle className="flex items-start gap-2 text-base font-normal">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  &ldquo;{fixture.prompt}&rdquo;
                </CardTitle>
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
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            Type any request. Uses your own Anthropic API key — held only in this browser tab, sent
            per-request, never stored on our server.
          </p>

          <Input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />

          {projectsQuery.data && projectsQuery.data.length > 1 && (
            <Select value={projectId} onValueChange={setSelectedProjectId}>
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

          <TranscriptList items={transcript} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
