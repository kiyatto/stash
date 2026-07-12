import {
  StashItemsFullError,
  StorageQuotaError,
} from "@/lib/storage/stashRepository";
import {
  StashLimitError,
  StashNotFoundError,
} from "@/lib/storage/ownedStashes";

export function getStorageErrorMessage(error: unknown): string {
  if (error instanceof StorageQuotaError) {
    return "Your browser storage is full. Remove an item or clear site data to save changes.";
  }
  if (error instanceof StashItemsFullError) {
    return `This stash can hold up to ${error.limit} items. Delete something to add more.`;
  }
  if (error instanceof StashLimitError) {
    return `You can create up to ${error.limit} stashes. Delete one to create another.`;
  }
  if (error instanceof StashNotFoundError) {
    return "This stash could not be found. It may have been deleted.";
  }
  if (error instanceof Error && /image exceeds/i.test(error.message)) {
    return "That image is too large. Try a smaller file (2MB max).";
  }
  if (error instanceof Error && /failed to upload image/i.test(error.message)) {
    return "Could not upload the image. Check your connection and try again.";
  }
  return "Something went wrong saving your stash. Try again.";
}
