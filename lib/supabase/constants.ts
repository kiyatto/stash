/** Mirrors server-side limits enforced in Supabase migrations. */
export const MAX_STASHES_PER_USER = 10;

export const STORAGE_BUCKETS = {
  avatars: "avatars",
  stashImages: "stash-images",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** `{userId}/filename` under the avatars bucket. */
export function avatarObjectPath(userId: string, filename: string) {
  return `${userId}/${filename}`;
}

/** `{userId}/{stashId}/{itemId}.{ext}` under the stash-images bucket. */
export function stashImageObjectPath(
  userId: string,
  stashId: string,
  itemId: string,
  ext: string
) {
  return `${userId}/${stashId}/${itemId}.${ext}`;
}
