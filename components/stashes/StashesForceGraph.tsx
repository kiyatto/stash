"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { seedToGradient } from "@/lib/supabase/profile";
import type { StashSummary } from "@/lib/storage/ownedStashes";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const PROFILE_ID = "__profile__";

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
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string;
  target: string;
};

type StashesForceGraphProps = {
  profile: GraphProfile;
  stashes: StashSummary[];
  width: number;
  height: number;
  onProfileClick: () => void;
  onStashClick: (stashId: string) => void;
  onStashRenameRequest: (stashId: string) => void;
};

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

export function StashesForceGraph({
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
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const [avatarReady, setAvatarReady] = useState(false);

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
    const nodes: GraphNode[] = [
      {
        id: PROFILE_ID,
        kind: "profile",
        label: profile.displayName || "You",
        avatarUrl: profile.avatarUrl,
        avatarSeed: profile.avatarSeed,
      },
      ...stashes.map((stash) => ({
        id: stash.id,
        kind: "stash" as const,
        label: stash.name,
        itemCount: stash.itemCount,
      })),
    ];
    const links: GraphLink[] = stashes.map((stash) => ({
      source: PROFILE_ID,
      target: stash.id,
    }));
    return { nodes, links };
  }, [profile, stashes]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = fg.d3Force?.("charge");
    if (charge?.strength) charge.strength(-280);
    const link = fg.d3Force?.("link");
    if (link?.distance) link.distance(140);
  }, [graphData]);

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isProfile = node.kind === "profile";
      const size = isProfile ? 56 : 72;
      const half = size / 2;
      const labelFont = Math.max(10 / globalScale, 3.2);

      ctx.save();

      if (isProfile) {
        const seed = node.avatarSeed ?? "default";
        const { from, to } = seedToGradient(seed);
        const gradient = ctx.createLinearGradient(
          x - half,
          y - half,
          x + half,
          y + half
        );
        gradient.addColorStop(0, from);
        gradient.addColorStop(1, to);

        roundRect(ctx, x - half, y - half, size, size, 14);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.save();
        roundRect(ctx, x - half, y - half, size, size, 14);
        ctx.clip();
        ctx.globalAlpha = 0.12;
        for (let i = 0; i < 40; i += 1) {
          const gx = x - half + ((i * 17 + seed.length * 3) % size);
          const gy = y - half + ((i * 29 + seed.charCodeAt(0)) % size);
          ctx.fillStyle = i % 2 === 0 ? "#000" : "#fff";
          ctx.fillRect(gx, gy, 2, 2);
        }
        ctx.restore();

        if (avatarReady && avatarImageRef.current && node.avatarUrl) {
          ctx.save();
          roundRect(ctx, x - half, y - half, size, size, 14);
          ctx.clip();
          ctx.drawImage(
            avatarImageRef.current,
            x - half,
            y - half,
            size,
            size
          );
          ctx.restore();
        }

        ctx.lineWidth = 1.5 / globalScale;
        ctx.strokeStyle = "rgba(80, 60, 40, 0.35)";
        roundRect(ctx, x - half, y - half, size, size, 14);
        ctx.stroke();
      } else {
        roundRect(ctx, x - half, y - half, size, size, 12);
        ctx.fillStyle = "rgba(255, 252, 247, 0.95)";
        ctx.fill();
        ctx.lineWidth = 1.25 / globalScale;
        ctx.strokeStyle = "rgba(80, 60, 40, 0.22)";
        ctx.stroke();

        const inset = 8;
        roundRect(
          ctx,
          x - half + inset,
          y - half + inset,
          size - inset * 2,
          size * 0.45,
          6
        );
        ctx.fillStyle = "rgba(180, 160, 130, 0.22)";
        ctx.fill();

        ctx.fillStyle = "rgba(80, 60, 40, 0.45)";
        ctx.font = `${Math.max(9 / globalScale, 2.8)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const count = node.itemCount ?? 0;
        ctx.fillText(
          count === 1 ? "1 item" : `${count} items`,
          x,
          y - half + inset + (size * 0.45) / 2
        );
      }

      ctx.fillStyle = "rgba(70, 50, 35, 0.9)";
      ctx.font = `italic ${labelFont * 1.35}px Georgia, "Times New Roman", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = node.label || (isProfile ? "You" : "Untitled");
      const maxWidth = size + 24;
      let drawLabel = label;
      if (ctx.measureText(drawLabel).width > maxWidth) {
        while (
          drawLabel.length > 1 &&
          ctx.measureText(`${drawLabel}…`).width > maxWidth
        ) {
          drawLabel = drawLabel.slice(0, -1);
        }
        drawLabel = `${drawLabel}…`;
      }
      ctx.fillText(drawLabel, x, y + half + 6 / globalScale);

      ctx.restore();
    },
    [avatarReady]
  );

  const paintPointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const size = node.kind === "profile" ? 56 : 72;
      const half = size / 2;
      roundRect(ctx, x - half, y - half, size, size, 12);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
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
      linkColor={() => "rgba(120, 100, 80, 0.28)"}
      linkWidth={1.25}
      cooldownTicks={80}
      onNodeClick={(node) => {
        const n = node as GraphNode;
        if (n.kind === "profile") onProfileClick();
        else onStashClick(n.id);
      }}
      onNodeRightClick={(node, event) => {
        event.preventDefault();
        const n = node as GraphNode;
        if (n.kind === "stash") onStashRenameRequest(n.id);
      }}
      onEngineStop={() => {
        fgRef.current?.zoomToFit?.(400, 64);
      }}
    />
  );
}
