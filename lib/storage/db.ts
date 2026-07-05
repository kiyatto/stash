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

export { STORE_NAME };
