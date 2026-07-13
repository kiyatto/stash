import { describe, expect, it } from "vitest";
import { seedToGradient } from "@/lib/supabase/profile";

describe("seedToGradient", () => {
  it("returns stable colors for the same seed", () => {
    expect(seedToGradient("abc")).toEqual(seedToGradient("abc"));
  });

  it("returns different colors for different seeds", () => {
    expect(seedToGradient("abc")).not.toEqual(seedToGradient("xyz"));
  });

  it("returns hsl color strings", () => {
    const { from, to } = seedToGradient("avatar-seed");
    expect(from).toMatch(/^hsl\(/);
    expect(to).toMatch(/^hsl\(/);
  });
});
