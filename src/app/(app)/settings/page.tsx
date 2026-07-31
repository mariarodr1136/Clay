"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, KeyRound, Plug } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentUsagePanel } from "@/components/agent/usage-panel";

function CopyableToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="border-border bg-muted/40 space-y-2 rounded-xl border p-3">
      <p className="text-sm font-medium">Copy this now — it won&apos;t be shown again.</p>
      <div className="flex items-center gap-2">
        <code className="bg-background flex-1 overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs">
          {token}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const tokensQuery = trpc.tokens.list.useQuery();
  const workspace = trpc.members.activeWorkspace.useQuery();
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  const create = trpc.tokens.create.useMutation({
    onSuccess: (result) => {
      setIssued(result.token);
      setName("");
      utils.tokens.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revoke = trpc.tokens.revoke.useMutation({
    onSuccess: () => {
      toast.success("Token revoked");
      utils.tokens.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const tokens = tokensQuery.data ?? [];
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
          <span className="bg-accent flex size-9 items-center justify-center rounded-full">
            <Plug className="text-accent-foreground size-4.5" />
          </span>
          Connect
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Give an AI assistant read-only access to this workspace. Clay speaks the Model Context
          Protocol, so anything that talks MCP — Claude Desktop, Claude Code, your own agent — can
          query your projects and tasks through the same allow-listed catalog Clay&apos;s own agent
          uses. It can read; it can&apos;t write, and it can&apos;t reach another workspace.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Create a token
        </h2>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate({ name: name.trim() });
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="token-name">What is it for?</Label>
            <Input
              id="token-name"
              value={name}
              maxLength={100}
              placeholder="Claude Desktop on my laptop"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <KeyRound data-icon="inline-start" />
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </form>

        {issued && <CopyableToken token={issued} />}
      </section>

      {tokens.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Tokens
          </h2>
          <div className="border-border divide-border divide-y rounded-2xl border">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {token.name}
                    {token.revokedAt && <Badge variant="outline">revoked</Badge>}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {token.prefix}…{" "}
                    <span className="font-sans">
                      {token.lastUsedAt
                        ? `last used ${formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true })}`
                        : "never used"}
                    </span>
                  </p>
                </div>
                {!token.revokedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate({ tokenId: token.id })}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Point a client at it
        </h2>
        <Card>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Add this to your MCP client&apos;s config, replacing the token with the one you
              created above. It connects to{" "}
              <strong className="text-foreground">
                {workspace.data?.name ?? "this workspace"}
              </strong>{" "}
              only.
            </p>
            <pre className="bg-muted overflow-x-auto rounded-xl p-3 font-mono text-xs leading-relaxed">
              {JSON.stringify(
                {
                  mcpServers: {
                    clay: {
                      type: "http",
                      url: `${origin}/api/mcp`,
                      headers: { Authorization: "Bearer clay_your_token_here" },
                    },
                  },
                },
                null,
                2
              )}
            </pre>
            <p className="text-muted-foreground text-xs">
              Three tools are exposed: <code>describe_entities</code>, <code>list_queries</code>,
              and <code>run_query</code>. All read-only.
            </p>
          </CardContent>
        </Card>
      </section>

      <AgentUsagePanel />
    </div>
  );
}
