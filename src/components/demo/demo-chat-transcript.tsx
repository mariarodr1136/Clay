"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  CircleCheck,
  Diff,
  LayoutDashboard,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import type { DemoChatBlock, DemoChatScenario } from "@/fixtures/demo-chat";
import { DemoViewRenderer } from "./demo-view-renderer";
import { Badge } from "@/components/ui/badge";

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%]">
        {text}
      </p>
    </div>
  );
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="flex gap-3">
      <span className="bg-accent mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
        <Image src="/logo.png" alt="" width={16} height={16} className="size-4" />
      </span>
      <p className="text-foreground/90 max-w-[85%] pt-1 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function ToolTrace({ block }: { block: Extract<DemoChatBlock, { kind: "tools" }> }) {
  return (
    <div className="ml-10 max-w-xl">
      <div className="border-border/70 bg-muted/30 overflow-hidden rounded-xl border">
        {block.calls.map((call, i) => (
          <div
            key={i}
            className="border-border/50 flex items-center gap-2.5 border-b px-3.5 py-2 text-xs last:border-b-0"
          >
            {call.status === "ok" ? (
              <CircleCheck className="size-3.5 shrink-0" style={{ color: "var(--status-done)" }} />
            ) : (
              <XCircle className="text-destructive size-3.5 shrink-0" />
            )}
            <code className="shrink-0 font-mono font-medium">{call.name}</code>
            <span className="text-muted-foreground min-w-0 truncate">{call.detail}</span>
            <span className="text-muted-foreground/70 ml-auto shrink-0 tabular-nums">
              {call.ms}ms
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground/70 mt-1 flex items-center gap-1 text-[11px]">
        <Wrench className="size-3" />
        Every proposal is validated against the query catalog before anything renders.
      </p>
    </div>
  );
}

function EmbeddedView({ block }: { block: Extract<DemoChatBlock, { kind: "view" }> }) {
  return (
    <div className="border-border bg-background/60 ml-0 overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.12)] sm:ml-10">
      <div className="border-border/70 bg-muted/40 flex items-center gap-2.5 border-b px-4 py-2.5">
        <span className="bg-accent flex size-6 items-center justify-center rounded-md">
          <LayoutDashboard className="text-accent-foreground size-3.5" />
        </span>
        <span className="text-sm font-medium">{block.view.name}</span>
        <Badge variant="outline" className="text-[10px]">
          v{block.version}
        </Badge>
        <span className="text-muted-foreground ml-1 hidden text-[11px] sm:inline">
          live render · not a screenshot
        </span>
        {block.savedViewId && (
          <Link
            href={`/demo/views/${block.savedViewId}`}
            className="text-accent-foreground ml-auto flex items-center gap-0.5 text-xs font-medium hover:underline"
          >
            Open saved view
            <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>
      <div className="p-4">
        <DemoViewRenderer view={block.view} />
      </div>
    </div>
  );
}

const diffGlyph = {
  add: { char: "+", colorVar: "--status-done" },
  change: { char: "±", colorVar: "--status-in-progress" },
  remove: { char: "−", colorVar: "--priority-urgent" },
} as const;

function DiffBlock({ block }: { block: Extract<DemoChatBlock, { kind: "diff" }> }) {
  return (
    <div className="ml-10 max-w-xl">
      <div className="border-border/70 overflow-hidden rounded-xl border">
        <div className="border-border/50 bg-muted/40 flex items-center gap-2 border-b px-3.5 py-2 text-xs font-medium">
          <Diff className="text-muted-foreground size-3.5" />
          Changes in version {block.version}
        </div>
        {block.changes.map((change, i) => (
          <div key={i} className="border-border/50 flex gap-2.5 border-b px-3.5 py-2 text-xs last:border-b-0">
            <span
              className="w-3 shrink-0 text-center font-mono font-bold"
              style={{ color: `var(${diffGlyph[change.op].colorVar})` }}
            >
              {diffGlyph[change.op].char}
            </span>
            <span className="text-muted-foreground">{change.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteBlock({ block }: { block: Extract<DemoChatBlock, { kind: "note" }> }) {
  const guardrail = block.tone === "guardrail";
  const color = guardrail ? "var(--priority-high)" : "var(--status-done)";
  return (
    <div className="ml-10 max-w-xl">
      <p
        className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium"
        style={{
          color,
          backgroundColor: `color-mix(in oklch, ${color}, transparent 92%)`,
        }}
      >
        {guardrail ? (
          <ShieldCheck className="size-4 shrink-0" />
        ) : (
          <CircleCheck className="size-4 shrink-0" />
        )}
        {block.text}
      </p>
    </div>
  );
}

export function DemoChatTranscript({ scenario }: { scenario: DemoChatScenario }) {
  return (
    <div className="space-y-5">
      {scenario.blocks.map((block, i) => {
        switch (block.kind) {
          case "user":
            return <UserBubble key={i} text={block.text} />;
          case "assistant":
            return <AssistantText key={i} text={block.text} />;
          case "tools":
            return <ToolTrace key={i} block={block} />;
          case "view":
            return <EmbeddedView key={i} block={block} />;
          case "diff":
            return <DiffBlock key={i} block={block} />;
          case "note":
            return <NoteBlock key={i} block={block} />;
        }
      })}
    </div>
  );
}
