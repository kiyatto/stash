"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { seedToColor } from "@/lib/supabase/profile";
import type { StashSummary } from "@/lib/storage/ownedStashes";
import {
  cartesianToPolar,
  loadGraphLayout,
  normalizeGraphLayout,
  polarToCartesian,
  resolveStashHomes,
  saveGraphLayout,
  syncGraphLayoutOrder,
  type GraphLayoutState,
} from "@/lib/storage/graphLayout";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const PROFILE_ID = "__profile__";
const PROFILE_NODE_SIZE = 40;
const STASH_NODE_SIZE = 58;
const STASH_NODE_RADIUS = 17;
/** Extra hit/paint band below the card for the title label. */
const LABEL_HIT_HEIGHT = 28;
const LABEL_HIT_PAD_X = 14;
const DEFAULT_GRAPH_ZOOM = 0.72;
/** Soft spring toward each node's rest position (updated on stash drag-end). */
const HOME_FORCE_STRENGTH = 0.12;
const CHARGE_STRENGTH = -28;
/** Links are visual only — home positions own the rest distance. */
const LINK_STRENGTH = 0;
/** Keep profile↔stash and stash↔stash from resting on top of each other. */
const COLLISION_PADDING = 36;
/** Lower decay = longer spring overshoot after drag. */
const VELOCITY_DECAY = 0.25;
const VIEW_MARGIN = 72;

function nodeRadius(node: GraphNode): number {
  return (node.kind === "profile" ? PROFILE_NODE_SIZE : STASH_NODE_SIZE) / 2;
}

function stashLabelHitWidth(node: GraphNode): number {
  const label = node.label || "Untitled";
  return Math.max(STASH_NODE_SIZE + LABEL_HIT_PAD_X * 2, label.length * 9 + 16);
}

export type GraphProfile = {
  displayName: string;
  avatarUrl?: string;
  avatarSeed: string;
};

type GraphNode = {
  id: string;
  kind: "profile" | "stash";
  label: string;
  itemCount?: number;
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

type GraphLink = {
  source: string;
  target: string;
};

type StashesForceGraphProps = {
  userId: string;
  profile: GraphProfile;
  stashes: StashSummary[];
  width: number;
  height: number;
  onProfileClick: () => void;
  onStashClick: (stashId: string) => void;
  onStashRenameRequest: (stashId: string) => void;
};

type HomeForce = ((alpha: number) => void) & {
  initialize: (nodes: GraphNode[]) => void;
};

function createHomeForce(axis: "x" | "y"): HomeForce {
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

function createCollisionForce(): HomeForce {
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

        const push =
          ((minDistance - distance) / distance) * alpha * 0.6;
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

function layoutRadiusForViewport(width: number, height: number) {
  const half = Math.min(width, height) / (2 * DEFAULT_GRAPH_ZOOM);
  return Math.max(96, half - VIEW_MARGIN - STASH_NODE_SIZE);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function circlePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw <= 0 || ih <= 0) return;

  const scale = Math.max(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
}

export function StashesForceGraph({
  userId,
  profile,
  stashes,
  width,
  height,
  onProfileClick,
  onStashClick,
  onStashRenameRequest,
}: StashesForceGraphProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const [avatarReady, setAvatarReady] = useState(false);
  const [layout, setLayout] = useState<GraphLayoutState>(() =>
    loadGraphLayout(userId)
  );

  const layoutRadius = layoutRadiusForViewport(width, height);
  const linkDistance = layoutRadius;
  const stashIds = useMemo(() => stashes.map((stash) => stash.id), [stashes]);
  const effectiveLayout = useMemo(
    () => normalizeGraphLayout(syncGraphLayoutOrder(layout, stashIds)),
    [layout, stashIds]
  );
  // Rebuild graph nodes only when membership/order changes — not when a drag
  // saves polar homes. Replacing graphData mid-settle zeros velocity and kills bounce.
  const layoutOrderKey = effectiveLayout.order.join("\0");

  useEffect(() => {
    saveGraphLayout(userId, effectiveLayout);
  }, [userId, effectiveLayout]);

  useEffect(() => {
    if (!profile.avatarUrl) {
      avatarImageRef.current = null;
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      avatarImageRef.current = img;
      setAvatarReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      avatarImageRef.current = null;
      setAvatarReady(false);
    };
    img.src = profile.avatarUrl;
    return () => {
      cancelled = true;
    };
  }, [profile.avatarUrl]);

  const graphData = useMemo(() => {
    const homes = resolveStashHomes(effectiveLayout, stashIds, layoutRadius);
    const nodes: GraphNode[] = [
      {
        id: PROFILE_ID,
        kind: "profile",
        label: profile.displayName || "You",
        avatarUrl: profile.avatarUrl,
        avatarSeed: profile.avatarSeed,
        x0: 0,
        y0: 0,
        x: 0,
        y: 0,
        fx: 0,
        fy: 0,
      },
      ...stashes.map((stash) => {
        const home = homes[stash.id] ?? {
          x0: layoutRadius,
          y0: 0,
        };
        return {
          id: stash.id,
          kind: "stash" as const,
          label: stash.name,
          itemCount: stash.itemCount,
          x0: home.x0,
          y0: home.y0,
          x: home.x0,
          y: home.y0,
        };
      }),
    ];
    const links: GraphLink[] = stashes.map((stash) => ({
      source: PROFILE_ID,
      target: stash.id,
    }));
    return { nodes, links };
    // effectiveLayout.positions intentionally omitted: drag updates x0/y0 in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see layoutOrderKey
  }, [
    profile.displayName,
    profile.avatarUrl,
    profile.avatarSeed,
    stashes,
    stashIds,
    layoutRadius,
    layoutOrderKey,
  ]);

  const centerCamera = useCallback(() => {
    const fg = fgRef.current;
    if (!fg || width <= 0 || height <= 0) return;
    // Keep nodes smaller by default and leave room for links and labels.
    fg.centerAt?.(0, 0, 0);
    fg.zoom?.(DEFAULT_GRAPH_ZOOM, 0);
  }, [width, height]);

  const applyForces = useCallback(() => {
    const fg = fgRef.current;
    if (!fg?.d3Force || width <= 0 || height <= 0) return false;

    // Profile stays anchored; stash homes control edge length.
    fg.d3Force("center", null);
    fg.d3Force("x", createHomeForce("x"));
    fg.d3Force("y", createHomeForce("y"));
    fg.d3Force("collide", createCollisionForce());

    const charge = fg.d3Force("charge");
    if (charge?.strength) charge.strength(CHARGE_STRENGTH);

    const link = fg.d3Force("link");
    if (link?.distance) link.distance(linkDistance);
    if (link?.strength) link.strength(LINK_STRENGTH);

    fg.d3VelocityDecay?.(VELOCITY_DECAY);
    centerCamera();
    fg.d3ReheatSimulation?.();
    return true;
  }, [width, height, linkDistance, centerCamera]);

  useEffect(() => {
    if (width <= 0 || height <= 0) return;

    let cancelled = false;
    let attempts = 0;
    let raf = 0;
    let timer = 0;

    // Dynamic import means fgRef is often null on the first effect pass.
    const tryApply = () => {
      if (cancelled) return;
      if (applyForces()) {
        raf = requestAnimationFrame(() => {
          if (!cancelled) centerCamera();
        });
        timer = window.setTimeout(() => {
          if (!cancelled) centerCamera();
        }, 50);
        return;
      }
      attempts += 1;
      if (attempts < 120) {
        raf = requestAnimationFrame(tryApply);
      }
    };

    tryApply();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [graphData, width, height, applyForces, centerCamera]);

  // Trackpad: two-finger scroll pans; pinch (ctrlKey wheel) zooms.
  // d3-zoom maps all wheel events to zoom by default, so we handle wheel ourselves.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || width <= 0 || height <= 0) return;

    const onWheel = (event: WheelEvent) => {
      const fg = fgRef.current;
      if (!fg) return;
      event.preventDefault();

      const k = typeof fg.zoom === "function" ? Number(fg.zoom()) || 1 : 1;

      if (event.ctrlKey) {
        const next = Math.min(
          8,
          Math.max(0.15, k * Math.pow(2, -event.deltaY * 0.01))
        );
        fg.zoom?.(next, 0);
        return;
      }

      const center =
        typeof fg.centerAt === "function" ? fg.centerAt() : { x: 0, y: 0 };
      fg.centerAt?.(
        (center?.x ?? 0) + event.deltaX / k,
        (center?.y ?? 0) + event.deltaY / k,
        0
      );
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [width, height]);

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isProfile = node.kind === "profile";
      const size = isProfile ? PROFILE_NODE_SIZE : STASH_NODE_SIZE;
      const half = size / 2;
      const labelFont = Math.max(10 / globalScale, 3.2);

      ctx.save();

      if (isProfile) {
        const seed = node.avatarSeed ?? "default";

        // Solid fill only — no grain/texture (avoids banding on the avatar).
        ctx.beginPath();
        ctx.arc(x, y, half, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = seedToColor(seed);
        ctx.fill();

        if (avatarReady && avatarImageRef.current && node.avatarUrl) {
          ctx.save();
          circlePath(ctx, x, y, half);
          ctx.clip();
          drawCoverImage(ctx, avatarImageRef.current, x, y, size);
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(x, y, half, 0, Math.PI * 2);
        ctx.closePath();
        ctx.lineWidth = 1.5 / globalScale;
        ctx.strokeStyle = "rgba(80, 60, 40, 0.35)";
        ctx.stroke();
      } else {
        roundRect(ctx, x - half, y - half, size, size, STASH_NODE_RADIUS);
        ctx.fillStyle = "rgba(255, 252, 247, 0.95)";
        ctx.fill();

        const inset = 8;
        roundRect(
          ctx,
          x - half + inset,
          y - half + inset,
          size - inset * 2,
          size * 0.48,
          10
        );
        ctx.fillStyle = "rgba(180, 160, 130, 0.22)";
        ctx.fill();

        ctx.fillStyle = "rgba(80, 60, 40, 0.45)";
        ctx.font = `${Math.max(8 / globalScale, 2.6)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const count = node.itemCount ?? 0;
        ctx.fillText(
          count === 1 ? "1 item" : `${count} items`,
          x,
          y - half + inset + (size * 0.48) / 2
        );

        ctx.lineWidth = 1.25 / globalScale;
        ctx.strokeStyle = "rgba(80, 60, 40, 0.22)";
        roundRect(ctx, x - half, y - half, size, size, STASH_NODE_RADIUS);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(70, 50, 35, 0.9)";
      ctx.font = `italic ${labelFont * 1.25}px Georgia, "Times New Roman", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = node.label || (isProfile ? "You" : "Untitled");
      ctx.fillText(label, x, y + half + 5 / globalScale);

      ctx.restore();
    },
    [avatarReady]
  );

  const paintPointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const size = node.kind === "profile" ? PROFILE_NODE_SIZE : STASH_NODE_SIZE;
      const half = size / 2;
      if (node.kind === "profile") {
        circlePath(ctx, x, y, half);
      } else {
        // Include the title label under the card so label clicks register.
        const hitWidth = stashLabelHitWidth(node);
        roundRect(
          ctx,
          x - hitWidth / 2,
          y - half,
          hitWidth,
          size + LABEL_HIT_HEIGHT,
          STASH_NODE_RADIUS
        );
      }
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  function isStashLabelClick(node: GraphNode, event: MouseEvent): boolean {
    const fg = fgRef.current;
    const container = containerRef.current;
    if (!fg?.screen2GraphCoords || !container) return false;
    const rect = container.getBoundingClientRect();
    const { x: gx, y: gy } = fg.screen2GraphCoords(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const half = STASH_NODE_SIZE / 2;
    const labelTop = y + half;
    const labelBottom = y + half + LABEL_HIT_HEIGHT;
    const labelHalfWidth = stashLabelHitWidth(node) / 2;
    return (
      gy >= labelTop &&
      gy <= labelBottom &&
      gx >= x - labelHalfWidth &&
      gx <= x + labelHalfWidth
    );
  }

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-none overscroll-none"
    >
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        // Library generics default to loose node shapes; cast painters to match.
        nodeCanvasObject={paintNode as never}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={paintPointerArea as never}
        linkColor={() => "rgba(105, 82, 60, 0.42)"}
        linkWidth={1.5}
        d3VelocityDecay={VELOCITY_DECAY}
        cooldownTicks={Infinity}
        // Drag-pan on background; wheel handled above for trackpad pan + pinch zoom.
        enableZoomInteraction={false}
        enablePanInteraction
        onNodeDragEnd={(node) => {
          const n = node as GraphNode;
          // Library clears fx/fy and cools alphaTarget; keep residual velocity so
          // the soft home spring can overshoot and settle with bounce.
          if (n.kind === "profile") {
            n.x0 = 0;
            n.y0 = 0;
            n.x = 0;
            n.y = 0;
            n.fx = 0;
            n.fy = 0;
            return;
          }

          const x = n.x ?? n.x0;
          const y = n.y ?? n.y0;
          const polar = cartesianToPolar(x, y, layoutRadius);
          const home = polarToCartesian(
            polar.angle,
            layoutRadius * polar.radiusRatio
          );
          // If dropped too close to the profile, spring back to the minimum
          // edge length while preserving the user's chosen angle.
          n.x0 = home.x0;
          n.y0 = home.y0;

          setLayout((prev) => {
            const synced = syncGraphLayoutOrder(prev, stashIds);
            const next: GraphLayoutState = {
              ...synced,
              positions: {
                ...synced.positions,
                [n.id]: polar,
              },
            };
            saveGraphLayout(userId, next);
            return next;
          });
        }}
        onNodeClick={(node, event) => {
          const n = node as GraphNode;
          if (n.kind === "profile") {
            onProfileClick();
            return;
          }
          if (isStashLabelClick(n, event)) {
            onStashRenameRequest(n.id);
            return;
          }
          onStashClick(n.id);
        }}
      />
    </div>
  );
}
