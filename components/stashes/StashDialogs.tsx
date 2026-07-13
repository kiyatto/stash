"use client";

import { useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/supabase/database.types";
import { getAvatarPublicUrl, seedToGradient } from "@/lib/supabase/profile";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

type ProfileEditorDialogProps = {
  open: boolean;
  profile: Profile;
  client: Client;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: Profile) => void;
  onUpload: (file: File) => Promise<Profile>;
  onRemoveAvatar: () => Promise<Profile>;
  onSaveName: (name: string) => Promise<Profile>;
};

function ProfileEditorForm({
  profile,
  client,
  onOpenChange,
  onSaved,
  onUpload,
  onRemoveAvatar,
  onSaveName,
}: Omit<ProfileEditorDialogProps, "open">) {
  const [name, setName] = useState(profile.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrl = getAvatarPublicUrl(client, profile.avatar_url);
  const gradient = seedToGradient(profile.avatar_seed);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const updated = await onSaveName(name);
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await onUpload(file);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const updated = await onRemoveAvatar();
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl font-normal italic">
          Your profile
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col items-center gap-4">
        <div
          className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border/60 shadow-sm"
          style={
            avatarUrl
              ? undefined
              : {
                  background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                }
          }
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-7 w-7 stroke-[1.25] text-foreground/40" />
          )}
          {avatarUrl ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="absolute right-1.5 top-1.5 rounded-full bg-background/85 p-1 shadow-sm"
              aria-label="Remove photo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {avatarUrl ? "Replace photo" : "Upload photo"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        <div className="flex w-full flex-col gap-2">
          <Label
            htmlFor="display-name"
            className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
          >
            Display name
          </Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="font-serif text-base italic"
            maxLength={80}
          />
        </div>
      </div>

      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="font-mono text-xs uppercase tracking-wide"
          onClick={() => onOpenChange(false)}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="font-mono text-xs uppercase tracking-wide"
          onClick={handleSave}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ProfileEditorDialog({
  open,
  profile,
  client,
  onOpenChange,
  onSaved,
  onUpload,
  onRemoveAvatar,
  onSaveName,
}: ProfileEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ProfileEditorForm
            key={`${profile.id}-${profile.updated_at}-${profile.avatar_url}`}
            profile={profile}
            client={client}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            onUpload={onUpload}
            onRemoveAvatar={onRemoveAvatar}
            onSaveName={onSaveName}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type StashEditorDialogProps = {
  open: boolean;
  mode: "create" | "rename";
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
  onDelete?: () => Promise<void>;
};

function StashEditorForm({
  mode,
  initialName,
  onOpenChange,
  onSave,
  onDelete,
}: Omit<StashEditorDialogProps, "open">) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save stash.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm("Delete this stash and all of its items?")) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete stash.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl font-normal italic">
          {mode === "create" ? "New stash" : "Rename stash"}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="stash-name"
          className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
        >
          Name
        </Label>
        <Input
          id="stash-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Stash"
          className="font-serif text-base italic"
          maxLength={120}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
          }}
        />
      </div>

      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter className="sm:justify-between">
        {mode === "rename" && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="font-mono text-xs uppercase tracking-wide text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDelete}
            disabled={busy}
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
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function StashEditorDialog({
  open,
  mode,
  initialName,
  onOpenChange,
  onSave,
  onDelete,
}: StashEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <StashEditorForm
            key={`${mode}-${initialName}`}
            mode={mode}
            initialName={initialName}
            onOpenChange={onOpenChange}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
