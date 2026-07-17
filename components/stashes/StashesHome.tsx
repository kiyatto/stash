"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportAnonStashDialog } from "@/components/migration/ImportAnonStashDialog";
import {
  ProfileEditorDialog,
  StashEditorDialog,
} from "@/components/stashes/StashDialogs";
import {
  StashesForceGraph,
  type GraphProfile,
} from "@/components/stashes/StashesForceGraph";
import { createClient } from "@/lib/supabase/client";
import {
  getAvatarPublicUrl,
  getOwnProfile,
  removeAvatar,
  updateDisplayName,
  uploadAvatar,
} from "@/lib/supabase/profile";
import {
  createOwnedStash,
  deleteOwnedStash,
  listOwnedStashes,
  renameOwnedStash,
  type StashSummary,
} from "@/lib/storage/ownedStashes";
import { MAX_STASHES_PER_USER } from "@/lib/supabase/constants";
import { getStorageErrorMessage } from "@/lib/storage/errors";
import { hasCompletedAnonMigration } from "@/lib/migration/flag";
import { getImportableAnonStash } from "@/lib/migration/importAnonStash";
import type { Profile } from "@/lib/supabase/database.types";

export function StashesHome() {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stashes, setStashes] = useState<StashSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingStash, setEditingStash] = useState<StashSummary | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importItemCount, setImportItemCount] = useState(0);

  const refresh = useCallback(async () => {
    const [nextProfile, nextStashes] = await Promise.all([
      getOwnProfile(client),
      listOwnedStashes(client),
    ]);
    setProfile(nextProfile);
    setStashes(nextStashes);
  }, [client]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [nextProfile, nextStashes] = await Promise.all([
          getOwnProfile(client),
          listOwnedStashes(client),
        ]);
        if (cancelled) return;
        setProfile(nextProfile);
        setStashes(nextStashes);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load your stashes."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    if (hasCompletedAnonMigration()) return;

    void getImportableAnonStash()
      .then((stash) => {
        if (cancelled || !stash) return;
        setImportItemCount(stash.items.length);
        setImportOpen(true);
      })
      .catch(() => {
        // Ignore IndexedDB probe failures — graph still works.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  const graphProfile: GraphProfile | null = profile
    ? {
        displayName: profile.display_name?.trim() || "You",
        avatarUrl: getAvatarPublicUrl(client, profile.avatar_url),
        avatarSeed: profile.avatar_seed,
      }
    : null;

  const atLimit = stashes.length >= MAX_STASHES_PER_USER;

  if (loading) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
        aria-busy="true"
      >
        <Loader2 className="h-5 w-5 animate-spin stroke-[1.5]" />
        <p className="font-mono text-xs uppercase tracking-widest">
          Loading stashes…
        </p>
      </div>
    );
  }

  if (error || !profile || !graphProfile) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
        role="alert"
      >
        <AlertCircle className="h-8 w-8 stroke-[1.25] text-destructive" />
        <p className="max-w-sm font-mono text-sm text-muted-foreground">
          {error ?? "Could not load your profile."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="font-mono text-xs uppercase tracking-wide"
          onClick={() => {
            setLoading(true);
            refresh()
              .then(() => setError(null))
              .catch((err) =>
                setError(
                  err instanceof Error
                    ? err.message
                    : "Failed to load your stashes."
                )
              )
              .finally(() => setLoading(false));
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 py-3">
        <div className="pointer-events-none">
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <Button
            type="button"
            size="sm"
            className="font-mono text-[10px] uppercase tracking-widest"
            disabled={atLimit}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="stroke-[1.5]" />
            New stash
          </Button>
          {atLimit ? (
            <p className="max-w-[12rem] text-right font-mono text-[10px] leading-relaxed text-muted-foreground">
              Limit of {MAX_STASHES_PER_USER} stashes reached
            </p>
          ) : (
            <p className="max-w-[14rem] text-right font-mono text-[10px] leading-relaxed text-muted-foreground/70">
              Click a stash to open · click its title to rename
            </p>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        {stashes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
            <p className="mt-24 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Create your first stash to get started
            </p>
          </div>
        ) : null}
        <StashesForceGraph
          key={`${profile.id}-${graphProfile.avatarUrl ?? graphProfile.avatarSeed}`}
          userId={profile.id}
          profile={graphProfile}
          stashes={stashes}
          width={size.width}
          height={size.height}
          onProfileClick={() => setProfileOpen(true)}
          onStashClick={(id) => router.push(`/stash/${id}`)}
          onStashRenameRequest={(id) => {
            const stash = stashes.find((s) => s.id === id);
            if (stash) setEditingStash(stash);
          }}
        />
      </div>

      <ProfileEditorDialog
        open={profileOpen}
        profile={profile}
        client={client}
        onOpenChange={setProfileOpen}
        onSaved={setProfile}
        onUpload={(file) => uploadAvatar(client, file)}
        onRemoveAvatar={() => removeAvatar(client)}
        onSaveName={(name) => updateDisplayName(client, name)}
      />

      <StashEditorDialog
        open={createOpen}
        mode="create"
        initialName="My Stash"
        onOpenChange={setCreateOpen}
        onSave={async (name) => {
          try {
            const created = await createOwnedStash(client, name);
            setStashes((prev) => [created, ...prev]);
            router.push(`/stash/${created.id}`);
          } catch (err) {
            throw new Error(getStorageErrorMessage(err));
          }
        }}
      />

      <StashEditorDialog
        open={editingStash !== null}
        mode="rename"
        initialName={editingStash?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setEditingStash(null);
        }}
        onSave={async (name) => {
          if (!editingStash) return;
          try {
            const updated = await renameOwnedStash(
              client,
              editingStash.id,
              name
            );
            setStashes((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            );
            setEditingStash(null);
          } catch (err) {
            throw new Error(getStorageErrorMessage(err));
          }
        }}
        onDelete={async () => {
          if (!editingStash) return;
          try {
            await deleteOwnedStash(client, editingStash.id);
            setStashes((prev) => prev.filter((s) => s.id !== editingStash.id));
            setEditingStash(null);
          } catch (err) {
            throw new Error(getStorageErrorMessage(err));
          }
        }}
      />

      <ImportAnonStashDialog
        open={importOpen}
        itemCount={importItemCount}
        onOpenChange={setImportOpen}
        onImported={() => {
          void refresh();
        }}
      />
    </div>
  );
}
