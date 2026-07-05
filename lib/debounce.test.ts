import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "@/lib/debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays invoking the callback until after the wait period", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel prevents a pending invocation", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(400);

    expect(fn).not.toHaveBeenCalled();
  });
});
