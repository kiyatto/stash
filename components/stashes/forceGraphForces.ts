import {
  HOME_FORCE_STRENGTH,
  HUB_TETHER_STRENGTH,
  PROFILE_HOME_STRENGTH,
  type GraphNode,
} from "@/components/stashes/forceGraphTypes";

export type SimForce = ((alpha: number) => void) & {
  initialize: (nodes: GraphNode[]) => void;
};

/** Soft spring toward each node's x0/y0 — same role as d3.forceX/Y in Graph.jsx. */
export function createHomeForce(
  axis: "x" | "y",
  getStrength: (node: GraphNode) => number = (node) =>
    node.kind === "profile" ? PROFILE_HOME_STRENGTH : HOME_FORCE_STRENGTH
): SimForce {
  let nodes: GraphNode[] = [];
  const homeKey = axis === "x" ? "x0" : "y0";
  const posKey = axis;
  const velKey = axis === "x" ? "vx" : "vy";

  const force = ((alpha: number) => {
    for (const node of nodes) {
      // Skip hard-fixed nodes (actively dragged).
      if (node.fx != null || node.fy != null) continue;
      const strength = getStrength(node);
      if (strength <= 0) continue;
      const home = node[homeKey];
      const pos = node[posKey] ?? 0;
      node[velKey] = (node[velKey] ?? 0) + (home - pos) * strength * alpha;
    }
  }) as SimForce;

  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };

  return force;
}

/**
 * Visual hub edges stay in graphData, but physics only pulls stashes toward
 * the profile. The profile is not yanked, so a gentle home spring can always
 * recenter it at (0, 0).
 */
export function createHubTetherForce(
  distance: number,
  strength: number = HUB_TETHER_STRENGTH
): SimForce {
  let nodes: GraphNode[] = [];

  const force = ((alpha: number) => {
    const profile = nodes.find((node) => node.kind === "profile");
    if (!profile) return;
    const px = profile.x ?? 0;
    const py = profile.y ?? 0;

    for (const node of nodes) {
      if (node.kind !== "stash") continue;
      if (node.fx != null || node.fy != null) continue;

      const dx = (node.x ?? 0) - px;
      const dy = (node.y ?? 0) - py;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const pull = ((dist - distance) / dist) * strength * alpha;
      node.vx = (node.vx ?? 0) - dx * pull;
      node.vy = (node.vy ?? 0) - dy * pull;
    }
  }) as SimForce;

  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };

  return force;
}

/** Keep the profile's rest target at the canvas origin. */
export function resetProfileHome(node: GraphNode | undefined) {
  if (!node || node.kind !== "profile") return;
  node.x0 = 0;
  node.y0 = 0;
  // Never leave fx/fy as 0 — force-graph treats that as pinned at the drop spot.
  if (node.fx != null) node.fx = undefined;
  if (node.fy != null) node.fy = undefined;
}
