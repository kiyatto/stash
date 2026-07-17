import { describe, expect, it } from "vitest";
import { createReadOnlyStashRepository } from "@/lib/storage/readOnlyStashRepository";
import { makeStash, makeStashItem } from "@/tests/helpers/fixtures";
import {
  DEFAULT_ITEM_HEIGHT,
  DEFAULT_ITEM_WIDTH,
} from "@/lib/types";

describe("createReadOnlyStashRepository", () => {
  it("returns the provided stash and rejects mutations", async () => {
    const stash = makeStash({
      id: "shared",
      items: [makeStashItem()],
    });
    const repo = createReadOnlyStashRepository(stash);

    await expect(repo.getOrCreateStash()).resolves.toEqual(stash);
    await expect(
      repo.createItem(stash, {
        name: "Nope",
        x: 0,
        y: 0,
        width: DEFAULT_ITEM_WIDTH,
        height: DEFAULT_ITEM_HEIGHT,
      })
    ).rejects.toThrow(/view-only/i);
    await expect(repo.deleteItem(stash, "item-1")).rejects.toThrow(
      /view-only/i
    );
  });
});
