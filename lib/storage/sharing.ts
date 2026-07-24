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

export type ShareStatus = {
  token: string | null;
  expiresAt: string | null;
};

export type ShareExpiryPreset = "7d" | "30d" | "never";

export function expiresAtFromPreset(
  preset: ShareExpiryPreset,
  from: Date = new Date()
): Date | null {
  if (preset === "never") return null;
  const ms = preset === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}

export function presetFromExpiresAt(
  expiresAt: string | null,
  now: Date = new Date()
): ShareExpiryPreset {
  if (!expiresAt) return "never";
  const ms = new Date(expiresAt).getTime() - now.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  // Prefer the closest preset within a day of tolerance.
  if (Math.abs(ms - sevenDays) <= 24 * 60 * 60 * 1000) return "7d";
  if (Math.abs(ms - thirtyDays) <= 24 * 60 * 60 * 1000) return "30d";
  return "never";
}

/** Returns the current share token and expiry for an owned stash. */
export async function getOwnedShareStatus(
  client: Client,
  stashId: string
): Promise<ShareStatus> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { data, error } = await client
    .from("stashes")
    .select("share_token, share_expires_at")
    .eq("id", stashId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load share status: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  return {
    token: data.share_token,
    expiresAt: data.share_expires_at,
  };
}

/** @deprecated Prefer getOwnedShareStatus */
export async function getOwnedShareToken(
  client: Client,
  stashId: string
): Promise<string | null> {
  const status = await getOwnedShareStatus(client, stashId);
  return status.token;
}

export type EnableSharingOptions = {
  /** Absolute expiry, or null for never. Defaults to never when omitted on create. */
  expiresAt?: Date | null;
};

/**
 * Ensures the stash has a share token. Reuses an existing token if present.
 * Always updates share_expires_at when `expiresAt` is provided.
 * Returns the token (caller builds `/share/[token]`).
 */
export async function enableStashSharing(
  client: Client,
  stashId: string,
  options: EnableSharingOptions = {}
): Promise<string> {
  const existing = await getOwnedShareStatus(client, stashId);
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const token = existing.token ?? uuidv4().replace(/-/g, "");
  const expiresAt =
    options.expiresAt === undefined
      ? existing.token
        ? existing.expiresAt
        : null
      : options.expiresAt === null
        ? null
        : options.expiresAt.toISOString();

  const { data, error } = await client
    .from("stashes")
    .update({
      share_token: token,
      share_expires_at: expiresAt,
    })
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

/** Updates expiry on an existing share link without rotating the token. */
export async function updateShareExpiry(
  client: Client,
  stashId: string,
  expiresAt: Date | null
): Promise<ShareStatus> {
  const status = await getOwnedShareStatus(client, stashId);
  if (!status.token) {
    throw new Error("Sharing is not enabled for this stash.");
  }

  const userId = await requireUserId(client, AUTH_MESSAGE);
  const { data, error } = await client
    .from("stashes")
    .update({
      share_expires_at: expiresAt === null ? null : expiresAt.toISOString(),
    })
    .eq("id", stashId)
    .eq("owner_id", userId)
    .select("share_token, share_expires_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update share expiry: ${error.message}`);
  }
  if (!data) {
    throw new StashNotFoundError(stashId);
  }

  return {
    token: data.share_token,
    expiresAt: data.share_expires_at,
  };
}

/** Clears the share token so existing links stop working. */
export async function revokeStashSharing(
  client: Client,
  stashId: string
): Promise<void> {
  const userId = await requireUserId(client, AUTH_MESSAGE);

  const { data, error } = await client
    .from("stashes")
    .update({ share_token: null, share_expires_at: null })
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
