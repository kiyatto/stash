import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { STORAGE_BUCKETS } from "@/lib/supabase/constants";

type Client = SupabaseClient<Database>;

async function removeStorageFolder(
  client: Client,
  bucket: string,
  folder: string
): Promise<void> {
  const { data, error: listError } = await client.storage
    .from(bucket)
    .list(folder, { limit: 1000 });

  if (listError) {
    throw new Error(`Failed to list ${bucket}/${folder}: ${listError.message}`);
  }

  const entries = data ?? [];
  const filePaths = entries
    .filter((entry) => entry.id !== null && Boolean(entry.name))
    .map((entry) => `${folder}/${entry.name}`);

  // Nested folders (stash-images/{userId}/{stashId}/…) — list one level deeper.
  const subfolders = entries.filter(
    (entry) => entry.id === null && Boolean(entry.name)
  );
  for (const sub of subfolders) {
    await removeStorageFolder(client, bucket, `${folder}/${sub.name}`);
  }

  if (filePaths.length === 0) return;

  const { error } = await client.storage.from(bucket).remove(filePaths);
  if (error) {
    throw new Error(
      `Failed to remove objects in ${bucket}/${folder}: ${error.message}`
    );
  }
}

/**
 * Deletes the authenticated user's storage objects and Auth user.
 * DB rows cascade from auth.users. Requires a service-role admin client.
 */
export async function deleteUserAccount(
  admin: Client,
  userId: string
): Promise<void> {
  try {
    await removeStorageFolder(admin, STORAGE_BUCKETS.avatars, userId);
  } catch {
    // Best-effort; Auth delete still proceeds.
  }

  try {
    await removeStorageFolder(admin, STORAGE_BUCKETS.stashImages, userId);
  } catch {
    // Best-effort; Auth delete still proceeds.
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete account: ${error.message}`);
  }
}
