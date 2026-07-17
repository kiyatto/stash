import { describe, expect, it } from "vitest";
import { seedToColor } from "@/lib/supabase/profile";

describe("seedToColor", () => {
  it("returns a stable color for the same seed", () => {
    expect(seedToColor("abc")).toBe(seedToColor("abc"));
  });

  it("returns different colors for different seeds", () => {
    expect(seedToColor("abc")).not.toBe(seedToColor("xyz"));
  });

  it("returns an hsl color string", () => {
    expect(seedToColor("avatar-seed")).toMatch(/^hsl\(/);
  });
});
