"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import {
  createCollisionForce,
  createHomeForce,
} from "@/components/stashes/forceGraphForces";
import {
  paintGraphNode,
  paintGraphPointerArea,
  type StashMeta,
} from "@/components/stashes/forceGraphPaint";
import {
  CHARGE_STRENGTH,
  DEFAULT_GRAPH_ZOOM,
  LABEL_HIT_HEIGHT,
  LINK_STRENGTH,
  PROFILE_ID,
  STASH_NODE_SIZE,
  VELOCITY_DECAY,
  layoutRadiusForViewport,
  stashLabelHitWidth,
  stashLabelIsAbove,
  type ForceGraphHandle,
  type GraphLink,
  type GraphNode,
  type GraphProfile,
} from "@/components/stashes/forceGraphTypes";

export type { GraphProfile };

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

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
  const fgRef = useRef<ForceGraphHandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const previewImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const stashMetaRef = useRef<Record<string, StashMeta>>({});
  const [avatarReady, setAvatarReady] = useState(false);
  const [layout, setLayout] = useState<GraphLayoutState>(() =>
    loadGraphLayout(userId)
  );

  const layoutRadius = layoutRadiusForViewport(width, height);
  const linkDistance = layoutRadius;
  const stashIds = useMemo(() => stashes.map((stash) => stash.id), [stashes]);
  const stashIdsKey = stashIds.join("\0");
  const previewUrlsKey = useMemo(
    () =>
      stashes
        .map((stash) => `${stash.id}:${stash.previewImageUrl ?? ""}`)
        .join("|"),
    [stashes]
  );
  const effectiveLayout = useMemo(
    () => normalizeGraphLayout(syncGraphLayoutOrder(layout, stashIds)),
    [layout, stashIds]
  );
  // Rebuild graph nodes only when membership/order changes — not when a drag
  // saves polar homes or when names/previews update.
  const layoutOrderKey = effectiveLayout.order.join("\0");
  const graphStructureKey = `${stashIdsKey}::${layoutOrderKey}::${layoutRadius}`;

  useEffect(() => {
    saveGraphLayout(userId, effectiveLayout);
  }, [userId, effectiveLayout]);

  useEffect(() => {
    stashMetaRef.current = Object.fromEntries(
      stashes.map((stash) => [
        stash.id,
        {
          label: stash.name,
          itemCount: stash.itemCount,
          previewImageUrl: stash.previewImageUrl,
        },
      ])
    );
  }, [stashes]);

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

  useEffect(() => {
    let cancelled = false;
    const next = new Map<string, HTMLImageElement>();
    const wanted = stashes.filter((stash) => stash.previewImageUrl);

    if (wanted.length === 0) {
      previewImagesRef.current = next;
      return;
    }

    let remaining = wanted.length;
    const commit = () => {
      if (cancelled || remaining > 0) return;
      previewImagesRef.current = next;
    };

    for (const stash of wanted) {
      const url = stash.previewImageUrl!;
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        next.set(stash.id, img);
        remaining -= 1;
        commit();
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining -= 1;
        commit();
      };
      img.src = url;
    }

    return () => {
      cancelled = true;
    };
  }, [previewUrlsKey, stashes]);

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
          previewImageUrl: stash.previewImageUrl,
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
    // Labels/previews are read from stashMetaRef during paint so rename/preview
    // updates do not replace live simulation nodes (which kills bounce).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see graphStructureKey
  }, [
    profile.displayName,
    profile.avatarUrl,
    profile.avatarSeed,
    graphStructureKey,
  ]);

  const centerCamera = useCallback(() => {
    const fg = fgRef.current;
    if (!fg || width <= 0 || height <= 0) return;
    fg.centerAt?.(0, 0, 0);
    fg.zoom?.(DEFAULT_GRAPH_ZOOM, 0);
  }, [width, height]);

  const applyForces = useCallback(() => {
    const fg = fgRef.current;
    if (!fg?.d3Force || width <= 0 || height <= 0) return false;

    fg.d3Force("center", null);
    fg.d3Force("x", createHomeForce("x"));
    fg.d3Force("y", createHomeForce("y"));
    fg.d3Force("collide", createCollisionForce());

    const charge = fg.d3Force("charge");
    if (charge?.strength) charge.strength(CHARGE_STRENGTH);

    const link = fg.d3Force("link");
    if (link?.distance) link.distance(linkDistance);
    if (link?.strength) link.strength(LINK_STRENGTH);

    // Prefer the React prop for decay; call the imperative API only when present.
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
  }, [graphStructureKey, width, height, applyForces, centerCamera]);

  // Trackpad: two-finger scroll pans; pinch (ctrlKey wheel) zooms.
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
      paintGraphNode(node, ctx, globalScale, {
        avatarReady,
        avatarImage: avatarImageRef.current,
        previewImages: previewImagesRef.current,
        stashMeta: stashMetaRef.current,
      });
    },
    [avatarReady]
  );

  const paintPointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      paintGraphPointerArea(node, color, ctx, stashMetaRef.current);
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
    const labelAbove = stashLabelIsAbove(node);
    const labelTop = labelAbove ? y - half - LABEL_HIT_HEIGHT : y + half;
    const labelBottom = labelAbove ? y - half : y + half + LABEL_HIT_HEIGHT;
    const label =
      stashMetaRef.current[node.id]?.label ?? node.label ?? "Untitled";
    const labelHalfWidth = stashLabelHitWidth(label) / 2;
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
        ref={fgRef as never}
        width={width}
        height={height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        nodeCanvasObject={paintNode as never}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={paintPointerArea as never}
        linkColor={() => "rgba(105, 82, 60, 0.42)"}
        linkWidth={1.5}
        d3VelocityDecay={VELOCITY_DECAY}
        cooldownTicks={Infinity}
        enableZoomInteraction={false}
        enablePanInteraction
        onNodeDragEnd={(node) => {
          const n = node as GraphNode;
          const fg = fgRef.current;
          if (n.kind === "profile") {
            n.x0 = 0;
            n.y0 = 0;
            n.x = 0;
            n.y = 0;
            n.fx = 0;
            n.fy = 0;
            fg?.d3ReheatSimulation?.();
            return;
          }

          const x = n.x ?? n.x0;
          const y = n.y ?? n.y0;
          const polar = cartesianToPolar(x, y, layoutRadius);
          const home = polarToCartesian(
            polar.angle,
            layoutRadius * polar.radiusRatio
          );
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
          fg?.d3ReheatSimulation?.();
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
