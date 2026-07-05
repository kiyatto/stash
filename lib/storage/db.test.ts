import { describe, expect, it } from "vitest";
import {
  deleteStashRecord,
  getStashRecord,
  isQuotaExceededError,
  putStashRecord,
} from "@/lib/storage/db";
import { makeStash } from "@/tests/helpers/fixtures";

describe("isQuotaExceededError", () => {
  it("returns true for QuotaExceededError DOMException", () => {
    const error = new DOMException("Quota exceeded", "QuotaExceededError");
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("returns true for legacy quota error code 22", () => {
    const error = Object.create(DOMException.prototype) as DOMException;
    Object.defineProperties(error, {
      name: { value: "QuotaExceededError" },
      code: { value: 22 },
    });
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isQuotaExceededError(new Error("nope"))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });
});

describe("stash record helpers", () => {
  it("writes, reads, and deletes stash records", async () => {
    const stash = makeStash({ name: "Persisted stash" });

    await putStashRecord(stash);
    expect(await getStashRecord(stash.id)).toEqual(stash);

    await deleteStashRecord(stash.id);
    expect(await getStashRecord(stash.id)).toBeUndefined();
  });
});
