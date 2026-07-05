import {
  StashItemsFullError,
  StorageQuotaError,
} from "@/lib/storage/stashRepository";

export function getStorageErrorMessage(error: unknown): string {
  if (error instanceof StorageQuotaError) {
    return "Your browser storage is full. Remove an item or clear site data to save changes.";
  }
  if (error instanceof StashItemsFullError) {
    return `This stash can hold up to ${error.limit} items. Delete something to add more.`;
  }
  return "Something went wrong saving your stash. Try again.";
}
