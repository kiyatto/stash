"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Share } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  buildShareUrl,
  enableStashSharing,
  getOwnedShareToken,
  revokeStashSharing,
} from "@/lib/storage/sharing";

type ShareStashDialogProps = {
  open: boolean;
  stashId: string;
  onOpenChange: (open: boolean) => void;
};

function ShareStashDialogBody({
  stashId,
  onOpenChange,
}: {
  stashId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const current = await getOwnedShareToken(createClient(), stashId);
        if (cancelled) return;
        setToken(current);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Could not load share status."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stashId]);

  const shareUrl =
    typeof window !== "undefined" && token
      ? buildShareUrl(window.location.origin, token)
      : "";

  async function handleEnableAndCopy() {
    setBusy(true);
    setActionError(null);
    try {
      const nextToken = await enableStashSharing(createClient(), stashId);
      setToken(nextToken);
      await navigator.clipboard.writeText(
        buildShareUrl(window.location.origin, nextToken)
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not create share link."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!token) {
      await handleEnableAndCopy();
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await navigator.clipboard.writeText(
        buildShareUrl(window.location.origin, token)
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Could not copy to clipboard.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (
      !window.confirm(
        "Revoke this share link? Anyone with the old URL will lose access."
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await revokeStashSharing(createClient(), stashId);
      setToken(null);
      setCopied(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not revoke share link."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl font-normal italic">
          Share stash
        </DialogTitle>
        <DialogDescription className="font-mono text-xs leading-relaxed text-muted-foreground">
          Anyone with the link can pan and zoom. They cannot edit items.
          Revoking invalidates the current link permanently.
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest">
            Loading…
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 stroke-[1.5] text-muted-foreground" />
            <Input
              readOnly
              value={
                shareUrl ||
                "Generate a link to share this stash with anyone"
              }
              className="border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0"
              aria-label="Share link"
            />
          </div>

          {loadError || actionError ? (
            <p className="font-mono text-xs text-destructive" role="alert">
              {loadError ?? actionError}
            </p>
          ) : null}
        </div>
      )}

      <DialogFooter className="sm:justify-between">
        {token ? (
          <Button
            type="button"
            variant="ghost"
            className="font-mono text-xs uppercase tracking-wide text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleRevoke}
            disabled={busy || loading}
          >
            Revoke link
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Close
          </Button>
          <Button
            type="button"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={token ? handleCopy : handleEnableAndCopy}
            disabled={busy || loading || Boolean(loadError)}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy link
              </>
            )}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function ShareStashDialog({
  open,
  stashId,
  onOpenChange,
}: ShareStashDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ShareStashDialogBody
            key={stashId}
            stashId={stashId}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ShareStashButton({
  stashId,
  className,
}: {
  stashId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={
          className ??
          "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
        }
        onClick={() => setOpen(true)}
      >
        <Share className="stroke-[1.5]" />
        Share
      </Button>
      <ShareStashDialog
        open={open}
        stashId={stashId}
        onOpenChange={setOpen}
      />
    </>
  );
}
