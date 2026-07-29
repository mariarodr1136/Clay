"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FolderKanban, KeyRound, MessageSquareText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useAgentStream } from "@/lib/use-agent-stream";
import { useByokKey, useByokModel } from "@/lib/use-byok-key";
import { TranscriptList } from "@/components/agent/transcript-list";
import {
  ConversationSidebar,
  ConversationTranscript,
} from "@/components/agent/conversation-history";
import { ModelPicker } from "@/components/agent/model-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Starting points that exercise the full widget range — clicking one
// prefills the prompt box, ready to send or edit.
const promptIdeas = [
  "Build a delivery dashboard: KPIs for open and overdue work, a stacked bar of task status by project, and a table of what's due this week",
  "Which tasks are overdue, who owns them, and how bad is it?",
  "Show our velocity by week and cycle time trend side by side",
  "Chart tasks created vs completed per day — are we keeping up?",
  "Give me a triage board of overdue work where I can change statuses inline",
  "Where is the remaining effort concentrated? Show story points as a donut by project",
];

export default function ChatPage() {
  const projectsQuery = trpc.projects.list.useQuery();
  const viewsQuery = trpc.views.list.useQuery();
  const searchParams = useSearchParams();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [apiKey, setApiKey] = useByokKey();
  const [model, setModel] = useByokModel();
  // Seeded from ?prompt=, which is how the command palette hands free text
  // over. Only the initial value — typing after that isn't fighting the URL.
  const [message, setMessage] = useState(() => searchParams.get("prompt") ?? "");
  const { transcript, isRunning, send } = useAgentStream();
  // Which past conversation is open. Null means the composer — starting a
  // new one is just clearing this.
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  // Default to the first project until the user explicitly picks one —
  // computed from the query result rather than mirrored into state via an
  // effect (there's nothing to keep in sync once loaded).
  const projectId = selectedProjectId || projectsQuery.data?.[0]?.id || "";
  const hasProjects = (projectsQuery.data?.length ?? 0) > 0;

  async function handleGenerate() {
    if (!apiKey.trim()) {
      toast.error("Enter your own Anthropic API key to use live mode.");
      return;
    }
    if (!projectId) {
      toast.error("Create a project first — the agent builds views over its tasks.");
      return;
    }
    if (!message.trim()) return;

    // Sending drops back to the live composer, so a reply never lands
    // underneath somebody's old conversation.
    setOpenThreadId(null);
    await send({ message: message.trim(), projectId, model }, apiKey.trim());
    viewsQuery.refetch();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Sticky, so a long transcript scrolls past a list that stays put. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ConversationSidebar selectedId={openThreadId} onSelect={setOpenThreadId} />
      </aside>

      <div className="min-w-0 space-y-8">
        <div className="space-y-1.5">
          <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
            <span className="bg-accent flex size-9 items-center justify-center rounded-full">
              <MessageSquareText className="text-accent-foreground size-4.5" />
            </span>
            Chat
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Describe the dashboard you need — KPIs, multi-series charts, donuts, meters, filters,
            tables — and the agent builds it against your real task data, validated against the query
            catalog. Refine it in follow-ups from the view itself.
          </p>
        </div>

        {projectsQuery.data && !hasProjects && (
          <div className="border-border flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 text-center">
            <div className="bg-muted flex size-11 items-center justify-center rounded-full">
              <FolderKanban className="text-muted-foreground size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">The agent needs something to chart</p>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
                Create a project with a few tasks (or load the sample workspace), then come back and
                ask for any dashboard.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard">Go to projects</Link>
            </Button>
          </div>
        )}

        {openThreadId && <ConversationTranscript threadId={openThreadId} />}

        {hasProjects && !openThreadId && (
          <>
            <div className="space-y-4">
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <KeyRound className="mt-0.5 size-4 shrink-0" />
                Live mode uses your own Anthropic API key — held only in this browser tab, sent
                per-request, never stored on our server.
              </p>

              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <ModelPicker value={model} onChange={setModel} className="w-44 shrink-0" />
              </div>

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
                placeholder='e.g. "build a delivery dashboard with velocity and overdue work"'
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <div className="flex flex-wrap gap-1.5">
                {promptIdeas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setMessage(idea)}
                    className="border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground max-w-full truncate rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors"
                    title={idea}
                  >
                    {idea}
                  </button>
                ))}
              </div>

              <Button onClick={handleGenerate} disabled={isRunning || !message.trim()}>
                {isRunning ? "Generating…" : "Generate"}
              </Button>
            </div>

            <TranscriptList items={transcript} />
          </>
        )}

      </div>
    </div>
  );
}
