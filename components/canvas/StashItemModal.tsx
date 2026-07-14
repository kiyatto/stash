"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { compressImageFile } from "@/lib/image";
import type { StashItem } from "@/lib/types";

export type StashItemFormValues = {
  name: string;
  imageDataUrl?: string;
  link: string;
  notes: string;
};

type StashItemModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialItem?: StashItem | null;
  onClose: () => void;
  onSave: (values: StashItemFormValues) => void;
  onDelete?: () => void;
};

const emptyValues: StashItemFormValues = {
  name: "",
  imageDataUrl: undefined,
  link: "",
  notes: "",
};

function imageFileFromClipboard(clipboardData: DataTransfer | null): File | null {
  if (!clipboardData) return null;

  for (const item of Array.from(clipboardData.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }

  for (const file of Array.from(clipboardData.files)) {
    if (file.type.startsWith("image/")) {
      return file;
    }
  }

  return null;
}

export function StashItemModal({
  open,
  mode,
  initialItem,
  onClose,
  onSave,
  onDelete,
}: StashItemModalProps) {
  // The parent remounts this component (via `key`) whenever it switches
  // between create/edit or between items, so lazy-initializing here is
  // enough to keep the form in sync without a state-syncing effect.
  const [values, setValues] = useState<StashItemFormValues>(() =>
    initialItem
      ? {
          name: initialItem.name,
          imageDataUrl: initialItem.imageDataUrl,
          link: initialItem.link ?? "",
          notes: initialItem.notes ?? "",
        }
      : emptyValues
  );
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCompressingRef = useRef(false);

  async function applyImageFile(file: File) {
    if (isCompressingRef.current) return;
    isCompressingRef.current = true;
    setIsCompressing(true);
    try {
      const dataUrl = await compressImageFile(file);
      setValues((prev) => ({ ...prev, imageDataUrl: dataUrl }));
    } finally {
      isCompressingRef.current = false;
      setIsCompressing(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await applyImageFile(file);
    } finally {
      e.target.value = "";
    }
  }

  useEffect(() => {
    if (!open) return;

    function handlePaste(event: ClipboardEvent) {
      const file = imageFileFromClipboard(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      void applyImageFile(file);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]);

  function handleSave() {
    onSave({
      ...values,
      name: values.name.trim(),
      link: values.link.trim(),
      notes: values.notes.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal italic">
            {mode === "create" ? "New stash item" : "Edit stash item"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground">
              Image
            </Label>
            <div
              tabIndex={values.imageDataUrl || isCompressing ? undefined : 0}
              role={values.imageDataUrl || isCompressing ? undefined : "group"}
              aria-label={
                values.imageDataUrl || isCompressing
                  ? undefined
                  : "Image drop zone. Paste an image or upload a file."
              }
              className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {isCompressing ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : values.imageDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={values.imageDataUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setValues((prev) => ({
                        ...prev,
                        imageDataUrl: undefined,
                      }))
                    }
                    className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 shadow-sm hover:bg-background"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 px-4 text-center">
                  <ImageIcon className="h-5 w-5 stroke-[1.25] text-muted-foreground" />
                  <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                    <span className="uppercase tracking-wide">Paste an image</span>
                    <span className="mt-1 block normal-case tracking-normal text-muted-foreground/80">
                      <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px] text-foreground/80">
                        ⌘V
                      </kbd>
                      {" / "}
                      <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px] text-foreground/80">
                        Ctrl+V
                      </kbd>
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-[10px] uppercase tracking-widest"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload file
                  </Button>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {values.imageDataUrl && !isCompressing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace image
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="item-name"
              className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
            >
              Item name
            </Label>
            <Input
              id="item-name"
              value={values.name}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. Cozy reading chair"
              className="font-serif text-base italic"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="item-link"
              className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
            >
              Link
            </Label>
            <Input
              id="item-link"
              type="url"
              value={values.link}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, link: e.target.value }))
              }
              placeholder="https://..."
              className="font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="item-notes"
              className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
            >
              Notes
            </Label>
            <Textarea
              id="item-notes"
              value={values.notes}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Any comments about this item..."
              rows={3}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {mode === "edit" && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="font-mono text-xs uppercase tracking-wide text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="font-mono text-xs uppercase tracking-wide"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="font-mono text-xs uppercase tracking-wide"
              onClick={handleSave}
              disabled={isCompressing}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
