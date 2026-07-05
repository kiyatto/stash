import { describe, expect, it, vi } from "vitest";
import * as db from "@/lib/storage/db";
import {
  ANON_STASH_EXPIRY_DAYS,
  ANON_STASH_ID,
  StashItemsFullError,
  StorageQuotaError,
  stashRepository,
} from "@/lib/storage/stashRepository";
import {
  DEFAULT_ITEM_HEIGHT,
  DEFAULT_ITEM_WIDTH,
  MAX_ITEMS_PER_STASH,
} from "@/lib/types";
import { makeStash, makeStashItem } from "@/tests/helpers/fixtures";

describe("IndexedDbStashRepository", () => {
  it("creates a fresh anonymous stash when none exists", async () => {
    const stash = await stashRepository.getOrCreateStash();

    expect(stash.id).toBe(ANON_STASH_ID);
    expect(stash.name).toBe("My Stash");
    expect(stash.items).toEqual([]);
    expect(stash.createdAt).toBeTruthy();
    expect(stash.updatedAt).toBeTruthy();
  });

  it("returns the existing stash on subsequent loads", async () => {
    const first = await stashRepository.getOrCreateStash();
    const { stash: withItem } = await stashRepository.createItem(first, {
      name: "Chair",
      x: 10,
      y: 20,
      width: DEFAULT_ITEM_WIDTH,
      height: DEFAULT_ITEM_HEIGHT,
    });

    const loaded = await stashRepository.getOrCreateStash();
    expect(loaded).toEqual(withItem);
  });

  it("getStash returns undefined for missing or expired stashes", async () => {
    expect(await stashRepository.getStash()).toBeUndefined();

    const expired = makeStash({
      updatedAt: new Date(
        Date.now() - (ANON_STASH_EXPIRY_DAYS + 1) * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
    await db.putStashRecord(expired);

    expect(await stashRepository.getStash()).toBeUndefined();
  });

  it("replaces an expired stash with a fresh one", async () => {
    const expired = makeStash({
      items: [makeStashItem()],
      updatedAt: new Date(
        Date.now() - (ANON_STASH_EXPIRY_DAYS + 1) * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
    await db.putStashRecord(expired);

    const fresh = await stashRepository.getOrCreateStash();
    expect(fresh.items).toEqual([]);
    expect(fresh.updatedAt).not.toBe(expired.updatedAt);
  });

  it("creates, updates, and deletes items", async () => {
    const stash = await stashRepository.getOrCreateStash();

    const { stash: withItem, item } = await stashRepository.createItem(stash, {
      name: "Reading chair",
      link: "https://example.com/chair",
      notes: "Comfy",
      x: 40,
      y: 80,
      width: DEFAULT_ITEM_WIDTH,
      height: DEFAULT_ITEM_HEIGHT,
    });

    expect(withItem.items).toHaveLength(1);
    expect(item.name).toBe("Reading chair");
    expect(item.x).toBe(40);

    const updated = await stashRepository.updateItem(withItem, item.id, {
      name: "Updated chair",
      x: 120,
      y: 160,
      width: 300,
      height: 320,
    });

    expect(updated.items[0]).toMatchObject({
      id: item.id,
      name: "Updated chair",
      x: 120,
      y: 160,
      width: 300,
      height: 320,
    });
    expect(new Date(updated.items[0]!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(item.updatedAt).getTime()
    );

    const deleted = await stashRepository.deleteItem(updated, item.id);
    expect(deleted.items).toEqual([]);
  });

  it("saveStash persists changes", async () => {
    const stash = await stashRepository.getOrCreateStash();
    const saved = await stashRepository.saveStash({
      ...stash,
      name: "Renamed stash",
    });

    expect(saved.name).toBe("Renamed stash");

    const loaded = await stashRepository.getOrCreateStash();
    expect(loaded.name).toBe("Renamed stash");
  });

  it("throws StashItemsFullError at the item limit", async () => {
    const items = Array.from({ length: MAX_ITEMS_PER_STASH }, (_, index) =>
      makeStashItem({ id: `item-${index}` })
    );
    const fullStash = makeStash({ items });

    await expect(
      stashRepository.createItem(fullStash, {
        name: "One too many",
        x: 0,
        y: 0,
        width: DEFAULT_ITEM_WIDTH,
        height: DEFAULT_ITEM_HEIGHT,
      })
    ).rejects.toBeInstanceOf(StashItemsFullError);
  });

  it("wraps IndexedDB quota errors as StorageQuotaError", async () => {
    const stash = await stashRepository.getOrCreateStash();

    vi.spyOn(db, "putStashRecord").mockRejectedValue(
      new DOMException("Quota exceeded", "QuotaExceededError")
    );

    await expect(
      stashRepository.createItem(stash, {
        name: "Overflow",
        x: 0,
        y: 0,
        width: DEFAULT_ITEM_WIDTH,
        height: DEFAULT_ITEM_HEIGHT,
      })
    ).rejects.toBeInstanceOf(StorageQuotaError);
  });
});
