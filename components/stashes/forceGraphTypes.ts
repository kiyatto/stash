export const PROFILE_ID = "__profile__";
export const PROFILE_NODE_SIZE = 72;
export const STASH_NODE_SIZE = 68;
/** Kept for hit-area rounding; stash nodes paint as circles. */
export const STASH_NODE_RADIUS = STASH_NODE_SIZE / 2;
/** Extra hit/paint band below the card for the title label. */
export const LABEL_HIT_HEIGHT = 22;
export const LABEL_HIT_PAD_X = 12;
export const DEFAULT_GRAPH_ZOOM = 0.72;
export const VIEW_MARGIN = 72;

/** Gentle rest spring for stash nodes. */
export const HOME_FORCE_STRENGTH = 0.028;
/**
 * Gentle origin spring for the profile. Kept free of hub-link pull so this
 * alone can recenter it slowly at (0, 0).
 */
export const PROFILE_HOME_STRENGTH = 0.055;
/** One-way hub tether strength (stashes only — does not yank the profile). */
export const HUB_TETHER_STRENGTH = 0.18;
export const CHARGE_STRENGTH = -18;
/** Lower decay = slower, floatier bounce. */
export const VELOCITY_DECAY = 0.18;
/** Graph.jsx: edgeLength * (min(width, height) / 7) */
export const LINK_EDGE_LENGTH = 1.5;
export const LINK_SCALE_DIVISOR = 7;
/** Soft settle after drag — low target + long window for a slow return. */
export const DRAG_SETTLE_ALPHA = 0.04;
export const DRAG_SETTLE_MS = 1400;

export type GraphProfile = {
  displayName: string;
  avatarUrl?: string;
  avatarSeed: string;
};

export type GraphNode = {
  id: string;
  kind: "profile" | "stash";
  label: string;
  itemCount?: number;
  previewImageUrl?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  /** Soft spring rest position (Graph.jsx x0/y0). */
  x0: number;
  y0: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

export type GraphLink = {
  source: string;
  target: string;
};

export type ForceGraphHandle = {
  centerAt?: {
    (x?: number, y?: number, ms?: number): { x: number; y: number } | void;
    (): { x: number; y: number };
  };
  zoom?: {
    (k?: number, ms?: number): number | void;
    (): number;
  };
  d3Force?: (
    name: string,
    force?: unknown
  ) =>
    | {
        strength?: (value: number) => unknown;
        distance?: (value: number) => unknown;
      }
    | undefined
    | null;
  d3VelocityDecay?: (decay: number) => void;
  d3AlphaTarget?: {
    (alpha?: number): number | void;
    (): number;
  };
  d3ReheatSimulation?: () => void;
  screen2GraphCoords?: (x: number, y: number) => { x: number; y: number };
};

export function stashLabelHitWidth(label: string): number {
  return Math.max(STASH_NODE_SIZE + LABEL_HIT_PAD_X * 2, label.length * 9 + 16);
}

/** The profile rests at y=0, so an upper stash has its edge below it. */
export function stashLabelIsAbove(node: GraphNode): boolean {
  return node.kind === "stash" && (node.y ?? 0) < 0;
}

export function layoutRadiusForViewport(width: number, height: number) {
  const half = Math.min(width, height) / (2 * DEFAULT_GRAPH_ZOOM);
  return Math.max(96, half - VIEW_MARGIN - STASH_NODE_SIZE);
}

/** Graph.jsx link rest length: edgeLength * min(width, height) / 7 */
export function linkDistanceForViewport(width: number, height: number) {
  return (LINK_EDGE_LENGTH * Math.min(width, height)) / LINK_SCALE_DIVISOR;
}

export type GraphBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function clamp(value: number, min: number, max: number) {
  if (max < min) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

/** Visible graph-space bounds for the current camera/viewport. */
export function viewportBounds(
  width: number,
  height: number,
  zoom: number,
  center: { x: number; y: number }
): GraphBounds {
  const k = zoom > 0 ? zoom : DEFAULT_GRAPH_ZOOM;
  const halfW = width / (2 * k);
  const halfH = height / (2 * k);
  return {
    minX: center.x - halfW,
    maxX: center.x + halfW,
    minY: center.y - halfH,
    maxY: center.y + halfH,
  };
}

function nodePad(node: GraphNode): { padX: number; padY: number } {
  const radius =
    (node.kind === "profile" ? PROFILE_NODE_SIZE : STASH_NODE_SIZE) / 2;
  // Keep labels roughly inside the canvas as well.
  const labelPad = node.kind === "stash" ? LABEL_HIT_HEIGHT * 0.55 : 0;
  return { padX: radius, padY: radius + labelPad };
}

/** Keep a node (and its drag pin) inside the padded canvas bounds. */
export function clampNodeToBounds(node: GraphNode, bounds: GraphBounds) {
  const { padX, padY } = nodePad(node);
  const x = clamp(node.x ?? 0, bounds.minX + padX, bounds.maxX - padX);
  const y = clamp(node.y ?? 0, bounds.minY + padY, bounds.maxY - padY);
  node.x = x;
  node.y = y;
  if (node.fx != null) node.fx = x;
  if (node.fy != null) node.fy = y;
}
