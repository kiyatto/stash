import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { MAX_STASHES_PER_USER } from "@/lib/supabase/constants";
import { removeStashImageFolder } from "@/lib/storage/stashImages";

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
};

function mapSummary(
  row: Database["public"]["Tables"]["stashes"]["Row"]
): StashSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isLimitError(message: string): boolean {
  return /stash limit reached/i.test(message);
}

async function requireUserId(client: Client): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in to manage stashes.");
  }

  return user.id;
}

/** Lists stashes owned by the current user (newest first). */
export async function listOwnedStashes(
  client: Client
): Promise<StashSummary[]> {
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("stashes")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list stashes: ${error.message}`);
  }

  return (data ?? []).map(mapSummary);
}

/** Creates a new stash. Does not auto-create on login — callers must opt in. */
export async function createOwnedStash(
  client: Client,
  name = "My Stash"
): Promise<StashSummary> {
  const userId = await requireUserId(client);

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
    .select("*")
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
  const userId = await requireUserId(client);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Stash name cannot be empty.");
  }

  const { data, error } = await client
    .from("stashes")
    .update({ name: trimmed })
    .eq("id", stashId)
    .eq("owner_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to rename stash: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  return mapSummary(data);
}

export async function deleteOwnedStash(
  client: Client,
  stashId: string
): Promise<void> {
  const userId = await requireUserId(client);

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

/** Loads a stash row owned by the current user, or throws. */
export async function getOwnedStashRow(
  client: Client,
  stashId: string
): Promise<StashSummary> {
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("stashes")
    .select("*")
    .eq("id", stashId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load stash: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  return mapSummary(data);
}
