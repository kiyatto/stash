import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  STORAGE_BUCKETS,
  stashImageObjectPath,
} from "@/lib/supabase/constants";
import { mimeToExt } from "@/lib/image";
import { MAX_IMAGE_BYTES } from "@/lib/types";

type Client = SupabaseClient<Database>;

export function isDataUrl(value: string | undefined | null): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

export function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) {
    throw new Error("Invalid image data URL");
  }

  const mimeMatch = /data:(.*?);/.exec(header);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const ext = mimeToExt(mime);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mime });
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} byte limit`);
  }

  return { blob, ext };
}

export function getStashImagePublicUrl(
  client: Client,
  path: string,
  version?: string | null
): string {
  const { data } = client.storage
    .from(STORAGE_BUCKETS.stashImages)
    .getPublicUrl(path);
  const url = data.publicUrl;
  // Image paths are stable (upserted in place), so bust browser/CDN caches on replace.
  if (!version) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(version)}`;
}

export async function uploadStashImage(
  client: Client,
  userId: string,
  stashId: string,
  itemId: string,
  dataUrl: string
): Promise<string> {
  const { blob, ext } = dataUrlToBlob(dataUrl);
  const path = stashImageObjectPath(userId, stashId, itemId, ext);

  const { error } = await client.storage
    .from(STORAGE_BUCKETS.stashImages)
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  return path;
}

export async function removeStashImage(
  client: Client,
  path: string | null | undefined
): Promise<void> {
  if (!path) return;

  const { error } = await client.storage
    .from(STORAGE_BUCKETS.stashImages)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to remove image: ${error.message}`);
  }
}

export async function removeStashImageFolder(
  client: Client,
  userId: string,
  stashId: string
): Promise<void> {
  const folder = `${userId}/${stashId}`;
  const { data, error: listError } = await client.storage
    .from(STORAGE_BUCKETS.stashImages)
    .list(folder);

  if (listError) {
    throw new Error(`Failed to list stash images: ${listError.message}`);
  }

  const paths = (data ?? [])
    .filter((entry) => Boolean(entry.name))
    .map((entry) => `${folder}/${entry.name}`);

  if (paths.length === 0) return;

  const { error } = await client.storage
    .from(STORAGE_BUCKETS.stashImages)
    .remove(paths);

  if (error) {
    throw new Error(`Failed to remove stash images: ${error.message}`);
  }
}
