import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { getDb, resetDbConnection, STORE_NAME } from "@/lib/storage/db";

beforeEach(async () => {
  resetDbConnection();
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.clear();
  await tx.done;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
