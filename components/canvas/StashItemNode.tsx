"use client";

import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpRight, ImageIcon } from "lucide-react";
import type { StashItem } from "@/lib/types";

export type StashItemNodeData = {
  item: StashItem;
  onResizeEnd: (itemId: string, width: number, height: number) => void;
  onResizeStart: () => void;
};

export type StashFlowNode = Node<StashItemNodeData, "stashItem">;

const MIN_WIDTH = 140;
const MIN_HEIGHT = 120;

export function StashItemNode({ data, selected }: NodeProps<StashFlowNode>) {
  const { item, onResizeEnd, onResizeStart } = data;

  return (
    <div className="h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        onResizeStart={onResizeStart}
        onResizeEnd={(_, params) =>
          onResizeEnd(item.id, params.width, params.height)
        }
        lineClassName="!border-foreground/40"
        handleClassName="!h-2 !w-2 !rounded-full !border !border-foreground/60 !bg-background"
      />
      <div
        className={`flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-colors hover:border-foreground/30 ${
          selected ? "border-foreground/50" : ""
        }`}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted">
          {item.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageDataUrl}
              alt={item.name || "Stash item"}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <ImageIcon className="h-7 w-7 stroke-[1.25] text-muted-foreground/35" />
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1 px-3.5 py-3">
          {item.link ? (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="nodrag group/link flex items-baseline gap-1 truncate font-serif text-base italic text-foreground underline-offset-4 hover:underline"
              title={item.name || item.link}
            >
              <span className="truncate">{item.name || item.link}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0 -translate-y-px stroke-[1.5] text-muted-foreground transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </a>
          ) : (
            <span
              className="truncate font-serif text-base italic text-foreground"
              title={item.name || "Untitled item"}
            >
              {item.name || "Untitled item"}
            </span>
          )}
          {item.notes ? (
            <span
              className="line-clamp-2 font-mono text-[11px] leading-relaxed text-muted-foreground"
              title={item.notes}
            >
              {item.notes}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
