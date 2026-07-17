import type { StashRepository } from "@/lib/storage/stashRepository";
import type { Stash } from "@/lib/types";

/**
 * Read-only repository backed by an already-loaded stash document.
 * Mutations throw — used for public `/share/[token]` views.
 */
export function createReadOnlyStashRepository(stash: Stash): StashRepository {
  return {
    async getStash() {
      return stash;
    },
    async getOrCreateStash() {
      return stash;
    },
    async saveStash() {
      throw new Error("This shared stash is view-only.");
    },
    async touchStash() {
      throw new Error("This shared stash is view-only.");
    },
    async createItem() {
      throw new Error("This shared stash is view-only.");
    },
    async updateItem() {
      throw new Error("This shared stash is view-only.");
    },
    async deleteItem() {
      throw new Error("This shared stash is view-only.");
    },
  };
}
