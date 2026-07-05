import { v4 as uuidv4 } from "uuid";
import {
  getStashRecord,
  isQuotaExceededError,
  putStashRecord,
} from "@/lib/storage/db";
import type {
  CreateItemInput,
  Stash,
  StashItem,
  UpdateItemInput,
} from "@/lib/types";
import { MAX_ITEMS_PER_STASH } from "@/lib/types";

// A single browser only gets one anonymous stash for the MVP. Once accounts
// exist, this id is what gets "claimed" and migrated into a user's account.
export const ANON_STASH_ID = "anon-stash";
export const ANON_STASH_EXPIRY_DAYS = 7;

export class StashItemsFullError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`Stash item limit reached (${limit})`);
    this.name = "StashItemsFullError";
    this.limit = limit;
  }
}

export class StorageQuotaError extends Error {
  constructor(cause?: unknown) {
    super("Browser storage quota exceeded");
    this.name = "StorageQuotaError";
    this.cause = cause;
  }
}

export interface StashRepository {
  getStash(): Promise<Stash | undefined>;
  getOrCreateStash(): Promise<Stash>;
  saveStash(stash: Stash): Promise<Stash>;
  touchStash(stash: Stash): Promise<Stash>;
  createItem(
    stash: Stash,
    data: CreateItemInput
  ): Promise<{ stash: Stash; item: StashItem }>;
  updateItem(
    stash: Stash,
    itemId: string,
    updates: UpdateItemInput
  ): Promise<Stash>;
  deleteItem(stash: Stash, itemId: string): Promise<Stash>;
}

function now() {
  return new Date().toISOString();
}

function emptyStash(): Stash {
  const timestamp = now();
  return {
    id: ANON_STASH_ID,
    name: "My Stash",
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isExpired(stash: Stash): boolean {
  const updated = new Date(stash.updatedAt).getTime();
  const ageMs = Date.now() - updated;
  const maxAgeMs = ANON_STASH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return ageMs > maxAgeMs;
}

async function writeStash(stash: Stash): Promise<void> {
  try {
    await putStashRecord(stash);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new StorageQuotaError(error);
    }
    throw error;
  }
}

class IndexedDbStashRepository implements StashRepository {
  async getStash(): Promise<Stash | undefined> {
    const stash = await getStashRecord(ANON_STASH_ID);
    if (!stash || isExpired(stash)) return undefined;
    return stash;
  }

  /**
   * Fetches the anonymous stash, creating a fresh one if none exists yet or if
   * the previous one expired from inactivity.
   */
  async getOrCreateStash(): Promise<Stash> {
    const existing = await getStashRecord(ANON_STASH_ID);
    if (!existing || isExpired(existing)) {
      const fresh = emptyStash();
      await writeStash(fresh);
      return fresh;
    }
    return existing;
  }

  async saveStash(stash: Stash): Promise<Stash> {
    const updated = { ...stash, updatedAt: now() };
    await writeStash(updated);
    return updated;
  }

  async touchStash(stash: Stash): Promise<Stash> {
    return this.saveStash(stash);
  }

  async createItem(
    stash: Stash,
    data: CreateItemInput
  ): Promise<{ stash: Stash; item: StashItem }> {
    if (stash.items.length >= MAX_ITEMS_PER_STASH) {
      throw new StashItemsFullError(MAX_ITEMS_PER_STASH);
    }

    const timestamp = now();
    const item: StashItem = {
      id: uuidv4(),
      name: data.name ?? "",
      imageDataUrl: data.imageDataUrl,
      link: data.link,
      notes: data.notes,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const updatedStash: Stash = {
      ...stash,
      items: [...stash.items, item],
      updatedAt: timestamp,
    };
    await writeStash(updatedStash);
    return { stash: updatedStash, item };
  }

  async updateItem(
    stash: Stash,
    itemId: string,
    updates: UpdateItemInput
  ): Promise<Stash> {
    const timestamp = now();
    const updatedStash: Stash = {
      ...stash,
      items: stash.items.map((item) =>
        item.id === itemId
          ? { ...item, ...updates, updatedAt: timestamp }
          : item
      ),
      updatedAt: timestamp,
    };
    await writeStash(updatedStash);
    return updatedStash;
  }

  async deleteItem(stash: Stash, itemId: string): Promise<Stash> {
    const updatedStash: Stash = {
      ...stash,
      items: stash.items.filter((item) => item.id !== itemId),
      updatedAt: now(),
    };
    await writeStash(updatedStash);
    return updatedStash;
  }
}

export const stashRepository: StashRepository = new IndexedDbStashRepository();
