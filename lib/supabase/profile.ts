import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/database.types";
import {
  STORAGE_BUCKETS,
  avatarObjectPath,
} from "@/lib/supabase/constants";
import { MAX_IMAGE_BYTES } from "@/lib/types";

type Client = SupabaseClient<Database>;

async function requireUserId(client: Client): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in to manage your profile.");
  }

  return user.id;
}

export function getAvatarPublicUrl(
  client: Client,
  path: string | null | undefined
): string | undefined {
  if (!path) return undefined;
  // avatar_url may already be a full URL from older writes
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const { data } = client.storage.from(STORAGE_BUCKETS.avatars).getPublicUrl(path);
  return data.publicUrl;
}

export async function getOwnProfile(client: Client): Promise<Profile> {
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    const hint =
      /Could not find the table|schema cache/i.test(error.message)
        ? " Apply the SQL in supabase/migrations/ to your Supabase project (see README)."
        : "";
    throw new Error(`Failed to load profile: ${error.message}.${hint}`);
  }

  if (!data) {
    // Trigger should have created the row; insert a fallback if missing.
    const { data: created, error: insertError } = await client
      .from("profiles")
      .insert({ id: userId })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }
    return created;
  }

  return data;
}

export async function updateDisplayName(
  client: Client,
  displayName: string
): Promise<Profile> {
  const userId = await requireUserId(client);
  const trimmed = displayName.trim();

  const { data, error } = await client
    .from("profiles")
    .update({ display_name: trimmed || null })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update display name: ${error.message}`);
  }

  return data;
}

export async function uploadAvatar(
  client: Client,
  file: File
): Promise<Profile> {
  const userId = await requireUserId(client);

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} byte limit`);
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";

  const path = avatarObjectPath(userId, `avatar.${ext}`);

  const { error: uploadError } = await client.storage
    .from(STORAGE_BUCKETS.avatars)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  const { data, error } = await client
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save avatar: ${error.message}`);
  }

  return data;
}

export async function removeAvatar(client: Client): Promise<Profile> {
  const userId = await requireUserId(client);
  const profile = await getOwnProfile(client);

  if (profile.avatar_url && !profile.avatar_url.startsWith("http")) {
    await client.storage
      .from(STORAGE_BUCKETS.avatars)
      .remove([profile.avatar_url])
      .catch(() => undefined);
  }

  const { data, error } = await client
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to remove avatar: ${error.message}`);
  }

  return data;
}

/** Deterministic HSL colors from avatar_seed for grainy gradient fallback. */
export function seedToGradient(seed: string): {
  from: string;
  to: string;
} {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (hash * 7) % 360;
  return {
    from: `hsl(${h1} 28% 72%)`,
    to: `hsl(${h2} 22% 58%)`,
  };
}
