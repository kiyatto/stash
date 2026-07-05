"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
} from "@xyflow/react";
import { PackageOpen } from "lucide-react";
import {
  StashItemNode,
  type StashFlowNode,
} from "@/components/canvas/StashItemNode";
import {
  StashItemModal,
  type StashItemFormValues,
} from "@/components/canvas/StashItemModal";
import {
  createItem,
  deleteItem,
  getOrCreateStash,
  updateItem,
} from "@/lib/storage/stashRepository";
import {
  DEFAULT_ITEM_HEIGHT,
  DEFAULT_ITEM_WIDTH,
  MAX_ITEMS_PER_STASH,
  type Stash,
  type StashItem,
} from "@/lib/types";

const nodeTypes = { stashItem: StashItemNode };

type ModalState =
  | { mode: "create"; position: { x: number; y: number } }
  | { mode: "edit"; item: StashItem }
  | null;

function itemToNode(
  item: StashItem,
  onResizeEnd: (itemId: string, width: number, height: number) => void,
  onResizeStart: () => void
): StashFlowNode {
  return {
    id: item.id,
    type: "stashItem",
    position: { x: item.x, y: item.y },
    style: { width: item.width, height: item.height },
    data: { item, onResizeEnd, onResizeStart },
  };
}

function StashCanvasInner() {
  const [stash, setStash] = useState<Stash | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<StashFlowNode[]>([]);
  const [modalState, setModalState] = useState<ModalState>(null);
  const resizingRef = useRef(false);
  const { screenToFlowPosition } = useReactFlow();

  // Plain (hoisted) function declarations below intentionally avoid
  // useCallback: applyStash and the resize handlers reference each other,
  // and none of them need a stable identity for correctness here.
  function applyStash(updated: Stash) {
    setStash(updated);
    setNodes(
      updated.items.map((item) =>
        itemToNode(item, handleResizeEnd, handleResizeStart)
      )
    );
  }

  function handleResizeStart() {
    resizingRef.current = true;
  }

  function handleResizeEnd(itemId: string, width: number, height: number) {
    resizingRef.current = false;
    setStash((prev) => {
      if (!prev) return prev;
      void updateItem(prev, itemId, { width, height }).then(applyStash);
      return prev;
    });
  }

  useEffect(() => {
    let cancelled = false;
    getOrCreateStash().then((loaded) => {
      if (cancelled) return;
      applyStash(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount; applyStash is intentionally omitted since it's
    // recreated every render but doesn't need to retrigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onNodesChange(changes: NodeChange<StashFlowNode>[]) {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }

  function onNodeDragStop(_event: unknown, node: StashFlowNode) {
    setStash((prev) => {
      if (!prev) return prev;
      void updateItem(prev, node.id, {
        x: node.position.x,
        y: node.position.y,
      }).then(applyStash);
      return prev;
    });
  }

  function onNodeClick(_event: unknown, node: StashFlowNode) {
    if (resizingRef.current) return;
    setModalState({ mode: "edit", item: node.data.item });
  }

  function onPaneClick(event: React.MouseEvent) {
    if (!stash || stash.items.length >= MAX_ITEMS_PER_STASH) return;
    const flowPosition = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setModalState({
      mode: "create",
      position: {
        x: flowPosition.x - DEFAULT_ITEM_WIDTH / 2,
        y: flowPosition.y - DEFAULT_ITEM_HEIGHT / 2,
      },
    });
  }

  function closeModal() {
    setModalState(null);
  }

  function handleSave(values: StashItemFormValues) {
    if (!stash || !modalState) return;
    if (modalState.mode === "create") {
      createItem(stash, {
        ...values,
        x: modalState.position.x,
        y: modalState.position.y,
        width: DEFAULT_ITEM_WIDTH,
        height: DEFAULT_ITEM_HEIGHT,
      }).then(({ stash: updated }) => applyStash(updated));
    } else {
      updateItem(stash, modalState.item.id, values).then(applyStash);
    }
    setModalState(null);
  }

  function handleDelete() {
    if (!stash || modalState?.mode !== "edit") return;
    deleteItem(stash, modalState.item.id).then(applyStash);
    setModalState(null);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Loading your stash...
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView={nodes.length > 0}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="var(--dot-color)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {stash?.items.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <PackageOpen className="h-8 w-8 stroke-[1.25]" />
            <p className="font-mono text-xs uppercase tracking-widest">
              Click anywhere to add your first item
            </p>
          </div>
        </div>
      ) : null}

      <StashItemModal
        key={
          modalState === null
            ? "closed"
            : modalState.mode === "edit"
              ? `edit-${modalState.item.id}`
              : `create-${modalState.position.x}-${modalState.position.y}`
        }
        open={modalState !== null}
        mode={modalState?.mode ?? "create"}
        initialItem={modalState?.mode === "edit" ? modalState.item : null}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={modalState?.mode === "edit" ? handleDelete : undefined}
      />
    </div>
  );
}

export function StashCanvas() {
  return (
    <ReactFlowProvider>
      <StashCanvasInner />
    </ReactFlowProvider>
  );
}
