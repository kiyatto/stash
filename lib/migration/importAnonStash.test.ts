import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAnonMigrationFlag,
  hasCompletedAnonMigration,
  markAnonMigrationHandled,
  MIGRATION_FLAG_KEY,
} from "@/lib/migration/flag";
import {
  EmptyAnonStashError,
  getImportableAnonStash,
  importAnonStash,
} from "@/lib/migration/importAnonStash";
import * as ownedStashes from "@/lib/storage/ownedStashes";
import { StashLimitError } from "@/lib/storage/ownedStashes";
import * as db from "@/lib/storage/db";
import { stashRepository } from "@/lib/storage/stashRepository";
import {
  DEFAULT_ITEM_HEIGHT,
  DEFAULT_ITEM_WIDTH,
} from "@/lib/types";
import { makeStash, makeStashItem } from "@/tests/helpers/fixtures";

const memoryStore = new Map<string, string>();

beforeEach(() => {
  memoryStore.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
    clear: () => memoryStore.clear(),
    key: () => null,
    get length() {
      return memoryStore.size;
    },
  });
});

vi.mock("@/lib/storage/supabaseStashRepository", () => ({
  createSupabaseStashRepository: () => ({
    getOrCreateStash: vi.fn(async () =>
      makeStash({ id: "remote-stash", items: [] })
    ),
    createItem: vi.fn(async (stash, data) => {
      const item = makeStashItem({
        id: `item-${stash.items.length + 1}`,
        name: data.name ?? "",
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        imageDataUrl: data.imageDataUrl,
      });
      return {
        stash: { ...stash, items: [...stash.items, item] },
        item,
      };
    }),
  }),
}));

describe("migration flag", () => {
  beforeEach(() => {
    clearAnonMigrationFlag();
  });

  it("tracks completion in localStorage", () => {
    expect(hasCompletedAnonMigration()).toBe(false);
    markAnonMigrationHandled();
    expect(hasCompletedAnonMigration()).toBe(true);
    expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBeTruthy();
  });
});

describe("importAnonStash", () => {
  beforeEach(async () => {
    clearAnonMigrationFlag();
    vi.restoreAllMocks();
    const existing = await stashRepository.getStash();
    if (existing) {
      await db.deleteStashRecord(existing.id);
    }
  });

  it("returns undefined when there is nothing to import", async () => {
    expect(await getImportableAnonStash()).toBeUndefined();
  });

  it("skips empty anon stashes", async () => {
    await stashRepository.getOrCreateStash();
    expect(await getImportableAnonStash()).toBeUndefined();
  });

  it("imports items then clears the local stash", async () => {
    const local = await stashRepository.getOrCreateStash();
    await stashRepository.createItem(local, {
      name: "Chair",
      x: 10,
      y: 20,
      width: DEFAULT_ITEM_WIDTH,
      height: DEFAULT_ITEM_HEIGHT,
    });

    vi.spyOn(ownedStashes, "createOwnedStash").mockResolvedValue({
      id: "remote-stash",
      name: "My Stash",
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:00:00.000Z",
      itemCount: 0,
    });

    const client = {} as never;
    const result = await importAnonStash(client);

    expect(result).toEqual({ stashId: "remote-stash", itemCount: 1 });
    expect(await stashRepository.getStash()).toBeUndefined();
    expect(hasCompletedAnonMigration()).toBe(true);
  });

  it("throws EmptyAnonStashError when empty", async () => {
    await expect(importAnonStash({} as never)).rejects.toBeInstanceOf(
      EmptyAnonStashError
    );
  });

  it("rethrows StashLimitError without clearing local data", async () => {
    const local = await stashRepository.getOrCreateStash();
    const { stash } = await stashRepository.createItem(local, {
      name: "Keep me",
      x: 0,
      y: 0,
      width: DEFAULT_ITEM_WIDTH,
      height: DEFAULT_ITEM_HEIGHT,
    });

    vi.spyOn(ownedStashes, "createOwnedStash").mockRejectedValue(
      new StashLimitError(10)
    );

    await expect(importAnonStash({} as never)).rejects.toBeInstanceOf(
      StashLimitError
    );
    expect(await stashRepository.getStash()).toEqual(stash);
    expect(hasCompletedAnonMigration()).toBe(false);
  });
});
