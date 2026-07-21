"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { StashSummary } from "@/lib/storage/ownedStashes";
import {
  resolveStashHomes,
  syncGraphLayoutOrder,
} from "@/lib/storage/graphLayout";
import { createHomeForce, createHubTetherForce, resetProfileHome } from "@/components/stashes/forceGraphForces";
import {
  paintGraphNode,
  paintGraphPointerArea,
  type StashMeta,
} from "@/components/stashes/forceGraphPaint";
import {
  CHARGE_STRENGTH,
  DEFAULT_GRAPH_ZOOM,
  DRAG_SETTLE_ALPHA,
  DRAG_SETTLE_MS,
  HUB_TETHER_STRENGTH,
  LABEL_HIT_HEIGHT,
  PROFILE_ID,
  STASH_NODE_SIZE,
  VELOCITY_DECAY,
  clampNodeToBounds,
  layoutRadiusForViewport,
  linkDistanceForViewport,
  stashLabelHitWidth,
  stashLabelIsAbove,
  viewportBounds,
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
  userId: _userId,
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
  const settleTimerRef = useRef(0);
  const [avatarReady, setAvatarReady] = useState(false);

  const layoutRadius = layoutRadiusForViewport(width, height);
  const linkDistance = linkDistanceForViewport(width, height);
  const stashIds = useMemo(() => stashes.map((stash) => stash.id), [stashes]);
  const stashIdsKey = stashIds.join("\0");
  const previewUrlsKey = useMemo(
    () =>
      stashes
        .map((stash) => `${stash.id}:${stash.previewImageUrl ?? ""}`)
        .join("|"),
    [stashes]
  );
  // Default clockwise homes only — drag updates x0/y0 in-session on the live nodes.
  const graphStructureKey = `${stashIdsKey}::${layoutRadius}`;

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

  useEffect(() => {
    return () => {
      window.clearTimeout(settleTimerRef.current);
    };
  }, []);

  const graphData = useMemo(() => {
    const layout = syncGraphLayoutOrder(
      { version: 1, order: [], positions: {} },
      stashIds
    );
    const homes = resolveStashHomes(layout, stashIds, layoutRadius);
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
    // updates do not replace live simulation nodes.
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

    // Gentle springs: default link force is visual-only; hub tether pulls
    // stashes only so the profile can soft-recenter at the origin.
    fg.d3Force("center", null);
    fg.d3Force("collide", null);
    fg.d3Force("x", createHomeForce("x"));
    fg.d3Force("y", createHomeForce("y"));
    fg.d3Force(
      "hubTether",
      createHubTetherForce(linkDistance, HUB_TETHER_STRENGTH)
    );

    const charge = fg.d3Force("charge") as
      | {
          strength?: (
            value: number | ((node: GraphNode, i: number, nodes: GraphNode[]) => number)
          ) => unknown;
        }
      | undefined
      | null;
    if (charge?.strength) {
      // Profile ignores charge so nothing but its home spring offsets it.
      charge.strength((node) =>
        node.kind === "profile" ? 0 : CHARGE_STRENGTH
      );
    }

    const link = fg.d3Force("link");
    if (link?.strength) link.strength(0);

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

  function getBounds() {
    const fg = fgRef.current;
    const k =
      typeof fg?.zoom === "function" ? Number(fg.zoom()) || DEFAULT_GRAPH_ZOOM : DEFAULT_GRAPH_ZOOM;
    const center =
      typeof fg?.centerAt === "function" ? fg.centerAt() : { x: 0, y: 0 };
    return viewportBounds(width, height, k, {
      x: center?.x ?? 0,
      y: center?.y ?? 0,
    });
  }

  function clampAllNodes() {
    const bounds = getBounds();
    for (const node of graphData.nodes) {
      clampNodeToBounds(node, bounds);
    }
  }

  function settleAfterDrag() {
    const fg = fgRef.current;
    // Graph.jsx: alphaTarget(0.1).restart(); then alphaTarget(0) after 500ms.
    fg?.d3AlphaTarget?.(DRAG_SETTLE_ALPHA);
    fg?.d3ReheatSimulation?.();
    window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      fgRef.current?.d3AlphaTarget?.(0);
    }, DRAG_SETTLE_MS);
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
        linkColor={() => "rgba(70, 52, 36, 0.2)"}
        linkWidth={1.25}
        d3VelocityDecay={VELOCITY_DECAY}
        cooldownTicks={Infinity}
        enableNodeDrag
        enableZoomInteraction={false}
        enablePanInteraction
        onEngineTick={clampAllNodes}
        onNodeDrag={(node) => {
          clampNodeToBounds(node as GraphNode, getBounds());
        }}
        onNodeDragEnd={(node) => {
          const n = node as GraphNode;
          clampNodeToBounds(n, getBounds());

          const profile = graphData.nodes.find(
            (candidate) => candidate.id === PROFILE_ID
          );
          // Profile always springs back to the box center.
          resetProfileHome(profile);

          if (n.kind === "stash") {
            // Session-only rest position — not persisted across reloads.
            n.x0 = n.x ?? n.x0;
            n.y0 = n.y ?? n.y0;
          }

          settleAfterDrag();
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
