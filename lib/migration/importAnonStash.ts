import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  createOwnedStash,
  StashLimitError,
} from "@/lib/storage/ownedStashes";
import { deleteStashRecord } from "@/lib/storage/db";
import {
  ANON_STASH_ID,
  stashRepository,
} from "@/lib/storage/stashRepository";
import { createSupabaseStashRepository } from "@/lib/storage/supabaseStashRepository";
import { markAnonMigrationHandled } from "@/lib/migration/flag";
import type { Stash } from "@/lib/types";

type Client = SupabaseClient<Database>;

export class EmptyAnonStashError extends Error {
  constructor() {
    super("Anonymous stash is empty or missing");
    this.name = "EmptyAnonStashError";
  }
}

export type ImportAnonStashResult = {
  stashId: string;
  itemCount: number;
};

/**
 * Reads the local anon stash (if any with items). Does not create one.
 */
export async function getImportableAnonStash(): Promise<Stash | undefined> {
  const stash = await stashRepository.getStash();
  if (!stash || stash.items.length === 0) return undefined;
  return stash;
}

/**
 * Imports the local IndexedDB anon stash into the signed-in account.
 * On success: clears the local copy and sets the one-time migration flag.
 * On failure mid-way: leaves IndexedDB intact so the user can retry.
 */
export async function importAnonStash(
  client: Client,
  options?: { name?: string }
): Promise<ImportAnonStashResult> {
  const local = await getImportableAnonStash();
  if (!local) {
    throw new EmptyAnonStashError();
  }

  let createdId: string | undefined;

  try {
    const created = await createOwnedStash(
      client,
      options?.name ?? local.name ?? "My Stash"
    );
    createdId = created.id;

    const repo = createSupabaseStashRepository(created.id, client);
    let remote = await repo.getOrCreateStash();

    for (const item of local.items) {
      const { stash } = await repo.createItem(remote, {
        name: item.name,
        imageDataUrl: item.imageDataUrl,
        link: item.link,
        notes: item.notes,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      });
      remote = stash;
    }

    await deleteStashRecord(ANON_STASH_ID);
    markAnonMigrationHandled();

    return {
      stashId: created.id,
      itemCount: local.items.length,
    };
  } catch (error) {
    // Best-effort cleanup of a half-created remote stash so retries work.
    if (createdId && !(error instanceof StashLimitError)) {
      try {
        const { deleteOwnedStash } = await import("@/lib/storage/ownedStashes");
        await deleteOwnedStash(client, createdId);
      } catch {
        // Keep the original error; orphaned stash can be deleted manually.
      }
    }
    throw error;
  }
}
