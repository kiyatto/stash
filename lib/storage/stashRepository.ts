import { v4 as uuidv4 } from "uuid";
import { getDb, STORE_NAME } from "@/lib/storage/db";
import type { Stash, StashItem } from "@/lib/types";

// A single browser only gets one anonymous stash for the MVP. Once accounts
// exist, this id is what gets "claimed" and migrated into a user's account.
export const ANON_STASH_ID = "anon-stash";
export const ANON_STASH_EXPIRY_DAYS = 7;

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

async function readStash(): Promise<Stash | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, ANON_STASH_ID);
}

async function writeStash(stash: Stash): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, stash);
}

/**
 * Fetches the anonymous stash, creating a fresh one if none exists yet or if
 * the previous one expired from inactivity.
 */
export async function getOrCreateStash(): Promise<Stash> {
  const existing = await readStash();
  if (!existing || isExpired(existing)) {
    const fresh = emptyStash();
    await writeStash(fresh);
    return fresh;
  }
  return existing;
}

export async function touchStash(stash: Stash): Promise<Stash> {
  const updated = { ...stash, updatedAt: now() };
  await writeStash(updated);
  return updated;
}

export async function createItem(
  stash: Stash,
  data: Pick<StashItem, "x" | "y" | "width" | "height"> &
    Partial<Pick<StashItem, "name" | "imageDataUrl" | "link" | "notes">>
): Promise<{ stash: Stash; item: StashItem }> {
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

export async function updateItem(
  stash: Stash,
  itemId: string,
  updates: Partial<Omit<StashItem, "id" | "createdAt">>
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

export async function deleteItem(
  stash: Stash,
  itemId: string
): Promise<Stash> {
  const updatedStash: Stash = {
    ...stash,
    items: stash.items.filter((item) => item.id !== itemId),
    updatedAt: now(),
  };
  await writeStash(updatedStash);
  return updatedStash;
}
