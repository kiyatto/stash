import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { MAX_STASHES_PER_USER } from "@/lib/supabase/constants";
import { requireUserId } from "@/lib/supabase/requireUserId";
import {
  getStashImagePublicUrl,
  removeStashImageFolder,
} from "@/lib/storage/stashImages";

type Client = SupabaseClient<Database>;

export class StashLimitError extends Error {
  readonly limit: number;

  constructor(limit: number = MAX_STASHES_PER_USER) {
    super(`Stash limit reached (${limit})`);
    this.name = "StashLimitError";
    this.limit = limit;
  }
}

export class StashNotFoundError extends Error {
  readonly stashId: string;

  constructor(stashId: string) {
    super(`Stash not found (${stashId})`);
    this.name = "StashNotFoundError";
    this.stashId = stashId;
  }
}

export type StashSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  /** Public URL for the earliest-created item's image, when present. */
  previewImageUrl?: string;
};

type StashRowWithCount = Database["public"]["Tables"]["stashes"]["Row"] & {
  stash_items?: { count: number }[] | null;
};

function mapSummary(row: StashRowWithCount): StashSummary {
  const countEntry = row.stash_items?.[0];
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: countEntry?.count ?? 0,
  };
}

/**
 * Attaches each stash's earliest-created item image (by `created_at`) when that
 * item has an `image_path`. Later items are ignored even if they have images.
 */
async function attachEarliestItemPreviews(
  client: Client,
  summaries: StashSummary[]
): Promise<StashSummary[]> {
  if (summaries.length === 0) return summaries;

  const { data, error } = await client
    .from("stash_items")
    .select("stash_id, image_path, updated_at, created_at")
    .in(
      "stash_id",
      summaries.map((stash) => stash.id)
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load stash previews: ${error.message}`);
  }

  const earliestByStash = new Map<
    string,
    { image_path: string | null; updated_at: string }
  >();
  for (const row of data ?? []) {
    if (earliestByStash.has(row.stash_id)) continue;
    earliestByStash.set(row.stash_id, {
      image_path: row.image_path,
      updated_at: row.updated_at,
    });
  }

  return summaries.map((stash) => {
    const earliest = earliestByStash.get(stash.id);
    const path = earliest?.image_path;
    if (!path) return stash;
    return {
      ...stash,
      previewImageUrl: getStashImagePublicUrl(
        client,
        path,
        earliest.updated_at
      ),
    };
  });
}

function isLimitError(message: string): boolean {
  return /stash limit reached/i.test(message);
}

const AUTH_MESSAGE = "You must be signed in to manage stashes.";

/** Lists stashes owned by the current user (newest first). */
export async function listOwnedStashes(
  client: Client
): Promise<StashSummary[]> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { data, error } = await client
    .from("stashes")
    .select("*, stash_items(count)")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list stashes: ${error.message}`);
  }

  return attachEarliestItemPreviews(client, (data ?? []).map(mapSummary));
}

/** Creates a new stash. Does not auto-create on login — callers must opt in. */
export async function createOwnedStash(
  client: Client,
  name = "My Stash"
): Promise<StashSummary> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { count, error: countError } = await client
    .from("stashes")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (countError) {
    throw new Error(`Failed to check stash limit: ${countError.message}`);
  }

  if ((count ?? 0) >= MAX_STASHES_PER_USER) {
    throw new StashLimitError(MAX_STASHES_PER_USER);
  }

  const { data, error } = await client
    .from("stashes")
    .insert({ owner_id: userId, name: name.trim() || "My Stash" })
    .select("*, stash_items(count)")
    .single();

  if (error) {
    if (isLimitError(error.message)) {
      throw new StashLimitError(MAX_STASHES_PER_USER);
    }
    throw new Error(`Failed to create stash: ${error.message}`);
  }

  return mapSummary(data);
}

export async function renameOwnedStash(
  client: Client,
  stashId: string,
  name: string
): Promise<StashSummary> {
  const userId = await requireUserId(client, AUTH_MESSAGE);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Stash name cannot be empty.");
  }

  const { data, error } = await client
    .from("stashes")
    .update({ name: trimmed })
    .eq("id", stashId)
    .eq("owner_id", userId)
    .select("*, stash_items(count)")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to rename stash: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  const [summary] = await attachEarliestItemPreviews(client, [
    mapSummary(data),
  ]);
  return summary!;
}

export async function deleteOwnedStash(
  client: Client,
  stashId: string
): Promise<void> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { data, error } = await client
    .from("stashes")
    .delete()
    .eq("id", stashId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete stash: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  // Best-effort Storage cleanup; DB rows are already gone via cascade.
  try {
    await removeStashImageFolder(client, userId, stashId);
  } catch {
    // Orphaned objects can be cleaned later; stash delete already succeeded.
  }
}

