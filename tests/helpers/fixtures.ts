/**
 * Test data factories — not a test file.
 * Use `makeStash()` / `makeStashItem()` to build typed fixtures in *.test.ts files.
 */
import type { Stash, StashItem } from "@/lib/types";
import { ANON_STASH_ID } from "@/lib/storage/stashRepository";

export function makeStashItem(overrides: Partial<StashItem> = {}): StashItem {
  const timestamp = "2026-07-01T12:00:00.000Z";
  return {
    id: "item-1",
    name: "Test item",
    link: "https://example.com",
    notes: "Some notes",
    x: 100,
    y: 200,
    width: 220,
    height: 260,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function makeStash(overrides: Partial<Stash> = {}): Stash {
  const timestamp = "2026-07-01T12:00:00.000Z";
  return {
    id: ANON_STASH_ID,
    name: "My Stash",
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
