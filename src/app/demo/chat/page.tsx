"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, MessageSquareText, SendHorizonal } from "lucide-react";
import { demoChatScenarios } from "@/fixtures/demo-chat";
import { DemoChatTranscript } from "@/components/demo/demo-chat-transcript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function DemoChatPage() {
  const [scenarioId, setScenarioId] = useState(demoChatScenarios[0].id);
  const scenario = demoChatScenarios.find((s) => s.id === scenarioId) ?? demoChatScenarios[0];
  const prompt = () => toast.info("Sign up to chat live with your own Anthropic API key.");

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
          <span className="bg-accent flex size-9 items-center justify-center rounded-full">
            <MessageSquareText className="text-accent-foreground size-4.5" />
          </span>
          Chat
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Describe the dashboard you need and the agent builds it against your real data — then
          refines it, version by version, in the same conversation. These transcripts are scripted,
          but every dashboard in them is rendered live from the workspace fixtures.
        </p>
      </div>

      <Tabs defaultValue="examples">
        <TabsList>
          <TabsTrigger value="examples">Example conversations</TabsTrigger>
          <TabsTrigger value="live">Live (bring your own key)</TabsTrigger>
        </TabsList>

        <TabsContent value="examples" className="space-y-6 pt-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {demoChatScenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenarioId(s.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-all",
                  s.id === scenarioId
                    ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card hover:border-foreground/20"
                )}
              >
                <p className="text-sm font-semibold">{s.title}</p>
                <p
                  className={cn(
                    "mt-0.5 text-xs leading-snug",
                    s.id === scenarioId ? "text-primary-foreground/75" : "text-muted-foreground"
                  )}
                >
                  {s.tagline}
                </p>
              </button>
            ))}
          </div>

          <DemoChatTranscript key={scenario.id} scenario={scenario} />

          <div className="border-border bg-card flex items-center gap-2 rounded-2xl border p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-12px_rgba(0,0,0,0.08)]">
            <Input
              placeholder="Ask for any dashboard — sign up to go live…"
              className="border-0 shadow-none focus-visible:ring-0"
              onFocus={prompt}
              readOnly
            />
            <Button size="icon-sm" className="shrink-0" onClick={prompt} aria-label="Send">
              <SendHorizonal />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="live" className="space-y-4 pt-4">
          <p className="text-muted-foreground flex max-w-xl items-start gap-2 text-sm">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            Type any request. Uses your own Anthropic API key — held only in this browser tab, sent
            per-request, never stored on our server.
          </p>

          <div className="max-w-xl space-y-3">
            <Input type="password" placeholder="sk-ant-..." onFocus={prompt} readOnly />
            <Textarea
              rows={3}
              placeholder='e.g. "build a delivery dashboard with velocity and overdue work"'
              onFocus={prompt}
              readOnly
            />
            <Button onClick={prompt}>Generate</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
