import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Stash } from "@/lib/types";

const DB_NAME = "stash-db";
const DB_VERSION = 1;
const STORE_NAME = "stashes";

interface StashDBSchema extends DBSchema {
  stashes: {
    key: string;
    value: Stash;
  };
}

let dbPromise: Promise<IDBPDatabase<StashDBSchema>> | null = null;

/** Clears the cached DB connection so the next call opens a fresh one. */
export function resetDbConnection(): void {
  dbPromise = null;
}

export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === 22)
  );
}

export function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<StashDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function getStashRecord(id: string): Promise<Stash | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, id);
}

export async function putStashRecord(stash: Stash): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, stash);
}

export async function deleteStashRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export { STORE_NAME };
