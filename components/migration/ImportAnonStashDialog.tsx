"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  EmptyAnonStashError,
  importAnonStash,
} from "@/lib/migration/importAnonStash";
import { markAnonMigrationHandled } from "@/lib/migration/flag";
import { StashLimitError } from "@/lib/storage/ownedStashes";
import { getStorageErrorMessage } from "@/lib/storage/errors";

type ImportAnonStashDialogProps = {
  open: boolean;
  itemCount: number;
  onOpenChange: (open: boolean) => void;
  onImported?: (stashId: string) => void;
};

export function ImportAnonStashDialog({
  open,
  itemCount,
  onOpenChange,
  onImported,
}: ImportAnonStashDialogProps) {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const result = await importAnonStash(client);
      onOpenChange(false);
      onImported?.(result.stashId);
      router.push(`/stash/${result.stashId}`);
      router.refresh();
    } catch (err) {
      if (err instanceof StashLimitError) {
        setError(getStorageErrorMessage(err));
      } else if (err instanceof EmptyAnonStashError) {
        markAnonMigrationHandled();
        onOpenChange(false);
      } else {
        setError(getStorageErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleSkip() {
    markAnonMigrationHandled();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal italic">
            Import your local stash?
          </DialogTitle>
          <DialogDescription className="font-mono text-xs leading-relaxed text-muted-foreground">
            This browser has a stash with {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"}. Import it into your account
            so it syncs across devices.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-3">
          <PackageOpen className="h-5 w-5 shrink-0 stroke-[1.25] text-muted-foreground" />
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            Images upload to your account. The local copy is cleared only after
            a successful import.
          </p>
        </div>

        {error ? (
          <p
            className="font-mono text-xs leading-relaxed text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={handleSkip}
            disabled={busy}
          >
            Not now
          </Button>
          <Button
            type="button"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={handleImport}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              "Import stash"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
