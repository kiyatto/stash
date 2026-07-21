import { getLocalStorage } from "@/lib/browser/localStorage";

const STORAGE_PREFIX = "stash:graph-layout:";

/** First stash sits slightly east of 12 o'clock so 2-node layouts aren't a vertical line. */
export const GRAPH_LAYOUT_START_ANGLE = -Math.PI / 2 + Math.PI / 7;
/**
 * Floor for stash distance from the profile, as a fraction of layout radius.
 * Kept high so edges stay readable and nodes don't sit on the avatar.
 */
export const MIN_STASH_RADIUS_RATIO = 0.95;
/** Default rest distance for newly placed stashes. */
export const DEFAULT_STASH_RADIUS_RATIO = 1;

export type PolarPosition = {
  /** Radians from +x, as from Math.atan2(y, x). */
  angle: number;
  /** Distance from profile as a fraction of the current layout radius. */
  radiusRatio: number;
};

export type GraphLayoutState = {
  version: 1;
  /** Stable clockwise order for default placement of new stashes. */
  order: string[];
  positions: Record<string, PolarPosition>;
};

function emptyLayout(): GraphLayoutState {
  return { version: 1, order: [], positions: {} };
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function clampRadiusRatio(ratio: number): number {
  return Math.min(1.35, Math.max(MIN_STASH_RADIUS_RATIO, ratio));
}

/** Rewrites short/invalid saved radii so old layouts can't keep overlapping. */
export function normalizeGraphLayout(state: GraphLayoutState): GraphLayoutState {
  const positions: Record<string, PolarPosition> = {};
  for (const [id, position] of Object.entries(state.positions)) {
    positions[id] = {
      angle: position.angle,
      radiusRatio: clampRadiusRatio(position.radiusRatio),
    };
  }
  return { version: 1, order: state.order, positions };
}

export function loadGraphLayout(userId: string): GraphLayoutState {
  const storage = getLocalStorage();
  if (!storage) return emptyLayout();

  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return emptyLayout();
    const parsed = JSON.parse(raw) as Partial<GraphLayoutState>;
    if (parsed.version !== 1 || !parsed.order || !parsed.positions) {
      return emptyLayout();
    }
    return normalizeGraphLayout({
      version: 1,
      order: parsed.order.filter((id) => typeof id === "string"),
      positions: Object.fromEntries(
        Object.entries(parsed.positions).filter(
          ([, value]) =>
            value &&
            typeof value.angle === "number" &&
            typeof value.radiusRatio === "number"
        )
      ),
    });
  } catch {
    return emptyLayout();
  }
}

export function saveGraphLayout(
  userId: string,
  state: GraphLayoutState
): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(
      storageKey(userId),
      JSON.stringify(normalizeGraphLayout(state))
    );
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

/**
 * Keeps known stash ids in a stable order: existing order first, then new ids
 * appended (so new stashes continue clockwise from the previous last).
 */
export function syncGraphLayoutOrder(
  state: GraphLayoutState,
  stashIds: string[]
): GraphLayoutState {
  const idSet = new Set(stashIds);
  const order = [
    ...state.order.filter((id) => idSet.has(id)),
    ...stashIds.filter((id) => !state.order.includes(id)),
  ];

  const positions: Record<string, PolarPosition> = {};
  for (const [id, position] of Object.entries(state.positions)) {
    if (idSet.has(id)) positions[id] = position;
  }

  return { version: 1, order, positions };
}

/** Clockwise from GRAPH_LAYOUT_START_ANGLE. */
export function defaultAngleForIndex(index: number, count: number): number {
  if (count <= 0) return GRAPH_LAYOUT_START_ANGLE;
  return GRAPH_LAYOUT_START_ANGLE - (index * 2 * Math.PI) / count;
}

export function polarToCartesian(
  angle: number,
  radius: number
): { x0: number; y0: number } {
  return {
    x0: Math.cos(angle) * radius,
    y0: Math.sin(angle) * radius,
  };
}

export function cartesianToPolar(
  x: number,
  y: number,
  layoutRadius: number
): PolarPosition {
  const distance = Math.hypot(x, y);
  const safeRadius = Math.max(layoutRadius, 1);
  return {
    angle: Math.atan2(y, x),
    radiusRatio: clampRadiusRatio(distance / safeRadius),
  };
}

/**
 * Resolves rest positions: saved polar coords when present, otherwise default
 * clockwise slots by stable order index.
 */
export function resolveStashHomes(
  state: GraphLayoutState,
  stashIds: string[],
  layoutRadius: number
): Record<string, { x0: number; y0: number }> {
  const synced = syncGraphLayoutOrder(state, stashIds);
  const count = Math.max(synced.order.length, 1);
  const homes: Record<string, { x0: number; y0: number }> = {};

  synced.order.forEach((id, index) => {
    const saved = synced.positions[id];
    if (saved) {
      homes[id] = polarToCartesian(
        saved.angle,
        layoutRadius * clampRadiusRatio(saved.radiusRatio)
      );
      return;
    }
    const angle = defaultAngleForIndex(index, count);
    const radius =
      layoutRadius *
      (DEFAULT_STASH_RADIUS_RATIO + (index % 3) * 0.03);
    homes[id] = polarToCartesian(angle, radius);
  });

  return homes;
}
