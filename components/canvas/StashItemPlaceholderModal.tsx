"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type StashItemPlaceholderModalProps = {
  open: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
};

export function StashItemPlaceholderModal({
  open,
  position,
  onClose,
}: StashItemPlaceholderModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal italic">
            New stash item
          </DialogTitle>
        </DialogHeader>

        <p className="font-mono text-sm leading-relaxed text-muted-foreground">
          Item details form coming in the next milestone. For now, click Cancel
          or press Escape to close without saving.
        </p>

        {position ? (
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Canvas position · x {Math.round(position.x)}, y{" "}
            {Math.round(position.y)}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={onClose}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
