"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Globe, Link2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ShareDialog({
  viewId,
  shareToken,
  onChanged,
}: {
  viewId: string;
  // The view's current token (null = not shared), owned by the parent query.
  shareToken: string | null;
  onChanged: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const setSharing = trpc.views.setSharing.useMutation({
    onSuccess: (result) => {
      toast.success(result.shareToken ? "Share link enabled" : "Share link revoked");
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });

  const shareUrl = shareToken
    ? `${typeof window === "undefined" ? "" : window.location.origin}/share/${shareToken}`
    : null;

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 className="size-3.5" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="text-muted-foreground size-4" />
            Share this view
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm leading-relaxed">
            A public, read-only link to this view. Visitors see a snapshot rendered with your
            data — no account, no editing, no filters. Revoking the link cuts off access
            immediately.
          </p>
          {shareUrl ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={setSharing.isPending}
                onClick={() => setSharing.mutate({ viewId, enabled: false })}
              >
                Revoke link
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={setSharing.isPending}
              onClick={() => setSharing.mutate({ viewId, enabled: true })}
            >
              {setSharing.isPending ? "Creating…" : "Create share link"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
