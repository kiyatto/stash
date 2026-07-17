import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  GRAPH_LAYOUT_START_ANGLE,
  cartesianToPolar,
  defaultAngleForIndex,
  loadGraphLayout,
  polarToCartesian,
  resolveStashHomes,
  saveGraphLayout,
  syncGraphLayoutOrder,
} from "@/lib/storage/graphLayout";

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

describe("graphLayout", () => {
  it("places defaults clockwise from the start angle", () => {
    expect(defaultAngleForIndex(0, 3)).toBeCloseTo(GRAPH_LAYOUT_START_ANGLE);
    expect(defaultAngleForIndex(1, 3)).toBeCloseTo(
      GRAPH_LAYOUT_START_ANGLE - (2 * Math.PI) / 3
    );
    expect(defaultAngleForIndex(2, 3)).toBeCloseTo(
      GRAPH_LAYOUT_START_ANGLE - (4 * Math.PI) / 3
    );
  });

  it("avoids a vertical line for two default nodes", () => {
    const a0 = defaultAngleForIndex(0, 2);
    const a1 = defaultAngleForIndex(1, 2);
    const p0 = polarToCartesian(a0, 100);
    const p1 = polarToCartesian(a1, 100);
    // Not axis-aligned: x components should be non-zero.
    expect(Math.abs(p0.x0)).toBeGreaterThan(1);
    expect(Math.abs(p1.x0)).toBeGreaterThan(1);
  });

  it("round-trips polar coordinates", () => {
    const polar = cartesianToPolar(60, -80, 100);
    const cart = polarToCartesian(polar.angle, 100 * polar.radiusRatio);
    expect(cart.x0).toBeCloseTo(60, 5);
    expect(cart.y0).toBeCloseTo(-80, 5);
  });

  it("keeps new and previously saved homes away from the profile", () => {
    expect(cartesianToPolar(10, 0, 100).radiusRatio).toBe(0.95);

    const homes = resolveStashHomes(
      {
        version: 1,
        order: ["a"],
        positions: { a: { angle: 0, radiusRatio: 0.35 } },
      },
      ["a"],
      100
    );

    expect(homes.a!.x0).toBeCloseTo(95);
    expect(homes.a!.y0).toBeCloseTo(0);
  });

  it("normalizes short radii when loading from storage", () => {
    saveGraphLayout("user-1", {
      version: 1,
      order: ["s1"],
      positions: { s1: { angle: 0.5, radiusRatio: 0.2 } },
    });

    expect(loadGraphLayout("user-1").positions.s1).toEqual({
      angle: 0.5,
      radiusRatio: 0.95,
    });
  });

  it("appends new stash ids and drops deleted ones", () => {
    const synced = syncGraphLayoutOrder(
      {
        version: 1,
        order: ["a", "gone", "b"],
        positions: {
          a: { angle: 1, radiusRatio: 0.9 },
          gone: { angle: 2, radiusRatio: 0.9 },
        },
      },
      ["b", "a", "c"]
    );

    expect(synced.order).toEqual(["a", "b", "c"]);
    expect(synced.positions).toEqual({
      a: { angle: 1, radiusRatio: 0.9 },
    });
  });

  it("persists layout per user", () => {
    saveGraphLayout("user-1", {
      version: 1,
      order: ["s1"],
      positions: { s1: { angle: 0.5, radiusRatio: 1.1 } },
    });

    expect(loadGraphLayout("user-1").positions.s1).toEqual({
      angle: 0.5,
      radiusRatio: 1.1,
    });
    expect(loadGraphLayout("user-2").order).toEqual([]);
  });

  it("prefers saved positions when resolving homes", () => {
    const homes = resolveStashHomes(
      {
        version: 1,
        order: ["a", "b"],
        positions: {
          a: { angle: 0, radiusRatio: 1 },
        },
      },
      ["a", "b"],
      100
    );

    expect(homes.a!.x0).toBeCloseTo(100);
    expect(homes.a!.y0).toBeCloseTo(0);
    // b uses default clockwise slot
    const expected = polarToCartesian(defaultAngleForIndex(1, 2), 100 * 1.03);
    expect(homes.b!.x0).toBeCloseTo(expected.x0);
    expect(homes.b!.y0).toBeCloseTo(expected.y0);
  });
});
