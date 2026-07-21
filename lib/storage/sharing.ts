import { v4 as uuidv4 } from "uuid";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { mapStashItemRow } from "@/lib/storage/mapStashItem";
import { StashNotFoundError } from "@/lib/storage/ownedStashes";
import { requireUserId } from "@/lib/supabase/requireUserId";
import type { Stash } from "@/lib/types";

type Client = SupabaseClient<Database>;

export class ShareNotFoundError extends Error {
  readonly token: string;

  constructor(token: string) {
    super(`Shared stash not found (${token})`);
    this.name = "ShareNotFoundError";
    this.token = token;
  }
}

const AUTH_MESSAGE = "You must be signed in to manage sharing.";

/** Returns the current share token for an owned stash, or null if not shared. */
export async function getOwnedShareToken(
  client: Client,
  stashId: string
): Promise<string | null> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { data, error } = await client
    .from("stashes")
    .select("share_token")
    .eq("id", stashId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load share status: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  return data.share_token;
}

/**
 * Ensures the stash has a share token. Reuses an existing token if present.
 * Returns the token (caller builds `/share/[token]`).
 */
export async function enableStashSharing(
  client: Client,
  stashId: string
): Promise<string> {
  const existing = await getOwnedShareToken(client, stashId);
  if (existing) return existing;

  const userId = await requireUserId(client, AUTH_MESSAGE);
  const token = uuidv4().replace(/-/g, "");

  const { data, error } = await client
    .from("stashes")
    .update({ share_token: token })
    .eq("id", stashId)
    .eq("owner_id", userId)
    .select("share_token")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to enable sharing: ${error.message}`);
  }
  if (!data?.share_token) {
    throw new StashNotFoundError(stashId);
  }

  return data.share_token;
}

/** Clears the share token so existing links stop working. */
export async function revokeStashSharing(
  client: Client,
  stashId: string
): Promise<void> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { data, error } = await client
    .from("stashes")
    .update({ share_token: null })
    .eq("id", stashId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to revoke sharing: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }
}

/** Loads a public shared stash by token via security-definer RPCs. */
export async function loadSharedStashByToken(
  client: Client,
  token: string
): Promise<Stash> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new ShareNotFoundError(token);
  }

  const { data: stashRows, error: stashError } = await client.rpc(
    "get_stash_by_share_token",
    { token: trimmed }
  );

  if (stashError) {
    throw new Error(`Failed to load shared stash: ${stashError.message}`);
  }

  const stashRow = stashRows?.[0];
  if (!stashRow) {
    throw new ShareNotFoundError(trimmed);
  }

  const { data: itemRows, error: itemsError } = await client.rpc(
    "get_stash_items_by_share_token",
    { token: trimmed }
  );

  if (itemsError) {
    throw new Error(`Failed to load shared items: ${itemsError.message}`);
  }

  return {
    id: stashRow.id,
    name: stashRow.name,
    items: (itemRows ?? []).map((row) => mapStashItemRow(row, client)),
    createdAt: stashRow.created_at,
    updatedAt: stashRow.updated_at,
  };
}

export function buildSharePath(token: string): string {
  return `/share/${token}`;
}

export function buildShareUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildSharePath(token)}`;
}
