"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStorageErrorMessage } from "@/lib/storage/errors";
import { renameOwnedStash } from "@/lib/storage/ownedStashes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type EditableStashNameProps = {
  stashId: string;
  initialName: string;
  className?: string;
};

export function EditableStashName({
  stashId,
  initialName,
  className,
}: EditableStashNameProps) {
  const client = useMemo(() => createClient(), []);
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  function startEditing() {
    if (saving) return;
    setError(null);
    setDraft(name);
    setEditing(true);
  }

  function cancelEditing() {
    skipCommitRef.current = true;
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  async function commitEditing() {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await renameOwnedStash(client, stashId, trimmed);
      setName(updated.name);
      setDraft(updated.name);
      setEditing(false);
    } catch (err) {
      setError(getStorageErrorMessage(err));
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className={cn("flex min-w-0 flex-col", className)}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          maxLength={120}
          aria-label="Stash name"
          aria-invalid={error ? true : undefined}
          className="min-w-0 truncate border-0 border-b border-border bg-transparent px-0 py-0 font-serif text-base italic text-foreground outline-none focus-visible:border-foreground disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commitEditing();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEditing();
            }
          }}
          onBlur={() => {
            void commitEditing();
          }}
        />
        {error ? (
          <p className="font-mono text-[10px] text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title="Rename stash"
      className={cn(
        "min-w-0 truncate text-left font-serif text-base italic text-foreground transition-colors hover:text-foreground/80",
        className
      )}
    >
      {name}
    </button>
  );
}
