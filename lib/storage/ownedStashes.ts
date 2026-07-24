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
  /** Explicit cover path when set; null means use auto first-image default. */
  coverImagePath?: string | null;
  /** Public URL for cover or first item image, when present. */
  previewImageUrl?: string;
};

export type StashCoverOption = {
  itemId: string;
  imagePath: string;
  imageUrl: string;
  name: string;
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
    coverImagePath: row.cover_image_path,
  };
}

/**
 * Resolves preview URLs: explicit cover_image_path wins; otherwise the first
 * item (by created_at) that has an image_path.
 */
async function attachPreviews(
  client: Client,
  summaries: StashSummary[]
): Promise<StashSummary[]> {
  if (summaries.length === 0) return summaries;

  const withCover = summaries.map((stash) => {
    if (!stash.coverImagePath) return stash;
    return {
      ...stash,
      previewImageUrl: getStashImagePublicUrl(
        client,
        stash.coverImagePath,
        stash.updatedAt
      ),
    };
  });

  const needingAuto = withCover.filter((stash) => !stash.coverImagePath);
  if (needingAuto.length === 0) return withCover;

  const { data, error } = await client
    .from("stash_items")
    .select("stash_id, image_path, updated_at, created_at")
    .in(
      "stash_id",
      needingAuto.map((stash) => stash.id)
    )
    .not("image_path", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load stash previews: ${error.message}`);
  }

  const firstImageByStash = new Map<
    string,
    { image_path: string; updated_at: string }
  >();
  for (const row of data ?? []) {
    if (!row.image_path || firstImageByStash.has(row.stash_id)) continue;
    firstImageByStash.set(row.stash_id, {
      image_path: row.image_path,
      updated_at: row.updated_at,
    });
  }

  return withCover.map((stash) => {
    if (stash.previewImageUrl) return stash;
    const first = firstImageByStash.get(stash.id);
    if (!first) return stash;
    return {
      ...stash,
      previewImageUrl: getStashImagePublicUrl(
        client,
        first.image_path,
        first.updated_at
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

  return attachPreviews(client, (data ?? []).map(mapSummary));
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

  const [summary] = await attachPreviews(client, [mapSummary(data)]);
  return summary!;
}

/** Lists item images that can be chosen as a stash cover. */
export async function listStashCoverOptions(
  client: Client,
  stashId: string
): Promise<StashCoverOption[]> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { data: stash, error: stashError } = await client
    .from("stashes")
    .select("id")
    .eq("id", stashId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (stashError) {
    throw new Error(`Failed to verify stash: ${stashError.message}`);
  }
  if (!stash) {
    throw new StashNotFoundError(stashId);
  }

  const { data, error } = await client
    .from("stash_items")
    .select("id, name, image_path, updated_at")
    .eq("stash_id", stashId)
    .not("image_path", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load cover options: ${error.message}`);
  }

  return (data ?? [])
    .filter((row): row is typeof row & { image_path: string } =>
      Boolean(row.image_path)
    )
    .map((row) => ({
      itemId: row.id,
      imagePath: row.image_path,
      imageUrl: getStashImagePublicUrl(client, row.image_path, row.updated_at),
      name: row.name || "Untitled",
    }));
}

/**
 * Sets an explicit cover from an item image path, or clears to the auto default
 * when `imagePath` is null.
 */
export async function setStashCoverImage(
  client: Client,
  stashId: string,
  imagePath: string | null
): Promise<StashSummary> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  if (imagePath) {
    const { data: item, error: itemError } = await client
      .from("stash_items")
      .select("id, image_path")
      .eq("stash_id", stashId)
      .eq("image_path", imagePath)
      .maybeSingle();

    if (itemError) {
      throw new Error(`Failed to verify cover image: ${itemError.message}`);
    }
    if (!item) {
      throw new Error("Cover image must belong to an item in this stash.");
    }
  }

  const { data, error } = await client
    .from("stashes")
    .update({ cover_image_path: imagePath })
    .eq("id", stashId)
    .eq("owner_id", userId)
    .select("*, stash_items(count)")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update stash cover: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  const [summary] = await attachPreviews(client, [mapSummary(data)]);
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
