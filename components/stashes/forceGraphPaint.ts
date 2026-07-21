import { seedToColor } from "@/lib/supabase/profile";
import {
  LABEL_HIT_HEIGHT,
  PROFILE_NODE_SIZE,
  STASH_NODE_RADIUS,
  STASH_NODE_SIZE,
  stashLabelHitWidth,
  stashLabelIsAbove,
  type GraphNode,
} from "@/components/stashes/forceGraphTypes";

export type StashMeta = {
  label: string;
  itemCount: number;
  previewImageUrl?: string;
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
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  centered: boolean
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw <= 0 || ih <= 0) return;

  const scale = Math.max(destW / iw, destH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const x = centered ? destX - dw / 2 : destX + (destW - dw) / 2;
  const y = centered ? destY - dh / 2 : destY + (destH - dh) / 2;
  ctx.drawImage(img, x, y, dw, dh);
}

export function paintGraphNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  options: {
    avatarReady: boolean;
    avatarImage: HTMLImageElement | null;
    previewImages: Map<string, HTMLImageElement>;
    stashMeta: Record<string, StashMeta>;
  }
) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const isProfile = node.kind === "profile";
  const size = isProfile ? PROFILE_NODE_SIZE : STASH_NODE_SIZE;
  const half = size / 2;
  const labelFont = Math.max(10 / globalScale, 3.2);

  ctx.save();

  if (isProfile) {
    const seed = node.avatarSeed ?? "default";

    ctx.beginPath();
    ctx.arc(x, y, half, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = seedToColor(seed);
    ctx.fill();

    if (options.avatarReady && options.avatarImage && node.avatarUrl) {
      ctx.save();
      circlePath(ctx, x, y, half);
      ctx.clip();
      drawCoverImage(ctx, options.avatarImage, x, y, size, size, true);
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

    const preview = options.previewImages.get(node.id);
    if (preview) {
      ctx.save();
      roundRect(ctx, x - half, y - half, size, size, STASH_NODE_RADIUS);
      ctx.clip();
      drawCoverImage(ctx, preview, x - half, y - half, size, size, false);
      ctx.restore();
    } else {
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
      const count =
        options.stashMeta[node.id]?.itemCount ?? node.itemCount ?? 0;
      ctx.fillText(
        count === 1 ? "1 item" : `${count} items`,
        x,
        y - half + inset + (size * 0.48) / 2
      );
    }

    ctx.lineWidth = 1.25 / globalScale;
    ctx.strokeStyle = "rgba(80, 60, 40, 0.22)";
    roundRect(ctx, x - half, y - half, size, size, STASH_NODE_RADIUS);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(70, 50, 35, 0.9)";
  ctx.font = `italic ${labelFont * 1.25}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  const label =
    (isProfile
      ? node.label
      : options.stashMeta[node.id]?.label ?? node.label) ||
    (isProfile ? "You" : "Untitled");
  if (stashLabelIsAbove(node)) {
    ctx.textBaseline = "bottom";
    ctx.fillText(label, x, y - half - 5 / globalScale);
  } else {
    ctx.textBaseline = "top";
    ctx.fillText(label, x, y + half + 5 / globalScale);
  }

  ctx.restore();
}

export function paintGraphPointerArea(
  node: GraphNode,
  color: string,
  ctx: CanvasRenderingContext2D,
  stashMeta: Record<string, StashMeta>
) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const size = node.kind === "profile" ? PROFILE_NODE_SIZE : STASH_NODE_SIZE;
  const half = size / 2;
  if (node.kind === "profile") {
    circlePath(ctx, x, y, half);
  } else {
    const label = stashMeta[node.id]?.label ?? node.label ?? "Untitled";
    const hitWidth = stashLabelHitWidth(label);
    const labelAbove = stashLabelIsAbove(node);
    roundRect(
      ctx,
      x - hitWidth / 2,
      y - half - (labelAbove ? LABEL_HIT_HEIGHT : 0),
      hitWidth,
      size + LABEL_HIT_HEIGHT,
      STASH_NODE_RADIUS
    );
  }
  ctx.fillStyle = color;
  ctx.fill();
}
