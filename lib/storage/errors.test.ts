import { describe, expect, it } from "vitest";
import {
  StashItemsFullError,
  StorageQuotaError,
} from "@/lib/storage/stashRepository";
import { getStorageErrorMessage } from "@/lib/storage/errors";

describe("getStorageErrorMessage", () => {
  it("returns a quota-specific message", () => {
    expect(getStorageErrorMessage(new StorageQuotaError())).toMatch(
      /storage is full/i
    );
  });

  it("returns an item-limit message", () => {
    expect(getStorageErrorMessage(new StashItemsFullError(50))).toMatch(
      /50 items/i
    );
  });

  it("returns a generic fallback message", () => {
    expect(getStorageErrorMessage(new Error("boom"))).toMatch(
      /something went wrong/i
    );
  });
});
