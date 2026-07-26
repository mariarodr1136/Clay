"use client";

import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { followUpSuggestions } from "@/lib/follow-up-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Static stand-in for ViewChatPanel — live mode calls /api/agent, which
// requires a real signed-in account regardless of BYOK key, so this can
// only ever route a demo visitor to sign-up.
export function DemoRefinePanel() {
  const prompt = () => toast.info("Sign up to refine views with your own Anthropic API key.");

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
        <Input type="password" placeholder="sk-ant-..." onFocus={prompt} readOnly />
        <Textarea
          rows={2}
          placeholder='e.g. "break the velocity chart down by project" or "add a filter for owner"'
          onFocus={prompt}
          readOnly
        />
        <div className="flex flex-wrap gap-1.5">
          {followUpSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={prompt}
              className="border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={prompt}>
          Send
        </Button>
      </CardContent>
    </Card>
  );
}
