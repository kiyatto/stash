export const PROFILE_ID = "__profile__";
export const PROFILE_NODE_SIZE = 40;
export const STASH_NODE_SIZE = 58;
export const STASH_NODE_RADIUS = 17;
/** Extra hit/paint band below the card for the title label. */
export const LABEL_HIT_HEIGHT = 28;
export const LABEL_HIT_PAD_X = 14;
export const DEFAULT_GRAPH_ZOOM = 0.72;
/** Soft spring toward each node's rest position (updated on stash drag-end). */
export const HOME_FORCE_STRENGTH = 0.12;
export const CHARGE_STRENGTH = -28;
/** Links are visual only — home positions own the rest distance. */
export const LINK_STRENGTH = 0;
/** Keep profile↔stash and stash↔stash from resting on top of each other. */
export const COLLISION_PADDING = 36;
/** Lower decay = longer spring overshoot after drag. */
export const VELOCITY_DECAY = 0.25;
export const VIEW_MARGIN = 72;

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
  /** Preferred rest position (soft spring target), like Graph.jsx x0/y0. */
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
  /** Present on force-graph instances; absent until the dynamic import mounts. */
  d3VelocityDecay?: (decay: number) => void;
  d3ReheatSimulation?: () => void;
  screen2GraphCoords?: (x: number, y: number) => { x: number; y: number };
};

export function nodeRadius(node: GraphNode): number {
  return (node.kind === "profile" ? PROFILE_NODE_SIZE : STASH_NODE_SIZE) / 2;
}

export function stashLabelHitWidth(label: string): number {
  return Math.max(STASH_NODE_SIZE + LABEL_HIT_PAD_X * 2, label.length * 9 + 16);
}

/** The profile is pinned at y=0, so an upper stash has its edge below it. */
export function stashLabelIsAbove(node: GraphNode): boolean {
  return node.kind === "stash" && (node.y ?? 0) < 0;
}

export function layoutRadiusForViewport(width: number, height: number) {
  const half = Math.min(width, height) / (2 * DEFAULT_GRAPH_ZOOM);
  return Math.max(96, half - VIEW_MARGIN - STASH_NODE_SIZE);
}
