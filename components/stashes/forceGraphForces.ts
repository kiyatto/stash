import {
  COLLISION_PADDING,
  HOME_FORCE_STRENGTH,
  nodeRadius,
  type GraphNode,
} from "@/components/stashes/forceGraphTypes";

export type HomeForce = ((alpha: number) => void) & {
  initialize: (nodes: GraphNode[]) => void;
};

export function createHomeForce(axis: "x" | "y"): HomeForce {
  let nodes: GraphNode[] = [];
  const homeKey = axis === "x" ? "x0" : "y0";
  const posKey = axis;
  const velKey = axis === "x" ? "vx" : "vy";

  const force = ((alpha: number) => {
    for (const node of nodes) {
      const home = node[homeKey];
      const pos = node[posKey] ?? 0;
      node[velKey] =
        (node[velKey] ?? 0) + (home - pos) * HOME_FORCE_STRENGTH * alpha;
    }
  }) as HomeForce;

  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };

  return force;
}

export function createCollisionForce(): HomeForce {
  let nodes: GraphNode[] = [];

  const force = ((alpha: number) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!a) continue;

      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (!b) continue;

        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const distance = Math.hypot(dx, dy) || 0.01;
        const minDistance = nodeRadius(a) + nodeRadius(b) + COLLISION_PADDING;
        if (distance >= minDistance) continue;

        const push = ((minDistance - distance) / distance) * alpha * 0.6;
        const pushX = dx * push;
        const pushY = dy * push;
        a.vx = (a.vx ?? 0) - pushX;
        a.vy = (a.vy ?? 0) - pushY;
        b.vx = (b.vx ?? 0) + pushX;
        b.vy = (b.vy ?? 0) + pushY;
      }
    }
  }) as HomeForce;

  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };

  return force;
}
