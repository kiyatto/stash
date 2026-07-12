"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
} from "@xyflow/react";
import {
  AlertCircle,
  Grip,
  Grid2x2,
  Loader2,
  Minus,
  PackageOpen,
  Plus,
  Scan,
  X,
} from "lucide-react";
import {
  StashItemNode,
  type StashFlowNode,
} from "@/components/canvas/StashItemNode";
import {
  StashItemModal,
  type StashItemFormValues,
} from "@/components/canvas/StashItemModal";
import { getStorageErrorMessage } from "@/lib/storage/errors";
import {
  StashItemsFullError,
  stashRepository as defaultStashRepository,
  type StashRepository,
} from "@/lib/storage/stashRepository";
import {
  DEFAULT_ITEM_HEIGHT,
  DEFAULT_ITEM_WIDTH,
  MAX_ITEMS_PER_STASH,
  type Stash,
  type StashItem,
} from "@/lib/types";
import { Button } from "@/components/ui/button";

const nodeTypes = { stashItem: StashItemNode };
const GEOMETRY_PERSIST_DEBOUNCE_MS = 400;
const ANON_STATUS_LABEL = "Unsaved · kept 7 days";

export type StashCanvasProps = {
  /** Defaults to the IndexedDB anonymous repository. */
  repository?: StashRepository;
  /** Top-left persistence hint. */
  statusLabel?: string;
};

type GeometryUpdate = Partial<
  Pick<StashItem, "x" | "y" | "width" | "height">
>;

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

function CanvasButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground shadow-sm transition-colors hover:border-border hover:text-foreground ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function StashCanvasInner({
  repository,
  statusLabel = ANON_STATUS_LABEL,
}: Required<Pick<StashCanvasProps, "repository">> &
  Pick<StashCanvasProps, "statusLabel">) {
  const [stash, setStash] = useState<Stash | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<StashFlowNode[]>([]);
  const [modalState, setModalState] = useState<ModalState>(null);
  const resizingRef = useRef(false);
  const pendingGeometryRef = useRef(new Map<string, GeometryUpdate>());
  const geometryTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );
  const repositoryRef = useRef(repository);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const [bgVariant, setBgVariant] = useState<"dots" | "lines">("dots");

  useEffect(() => {
    repositoryRef.current = repository;
  }, [repository]);

  const handleStorageError = useCallback((err: unknown) => {
    setError(getStorageErrorMessage(err));
  }, []);

  function toggleBg() {
    setBgVariant((v) => (v === "dots" ? "lines" : "dots"));
  }

  function applyStash(updated: Stash) {
    setStash(updated);
    setNodes(
      updated.items.map((item) =>
        itemToNode(item, handleResizeEnd, handleResizeStart)
      )
    );
  }

  function flushGeometryPersist(itemId: string) {
    const updates = pendingGeometryRef.current.get(itemId);
    pendingGeometryRef.current.delete(itemId);
    if (!updates) return;

    setStash((prev) => {
      if (!prev) return prev;
      void repositoryRef.current
        .updateItem(prev, itemId, updates)
        .then((updated) => {
          applyStash(updated);
          setError(null);
        })
        .catch(handleStorageError);
      return prev;
    });
  }

  function scheduleGeometryPersist(itemId: string, updates: GeometryUpdate) {
    pendingGeometryRef.current.set(itemId, {
      ...pendingGeometryRef.current.get(itemId),
      ...updates,
    });

    const existing = geometryTimersRef.current.get(itemId);
    if (existing) clearTimeout(existing);

    geometryTimersRef.current.set(
      itemId,
      setTimeout(() => {
        geometryTimersRef.current.delete(itemId);
        flushGeometryPersist(itemId);
      }, GEOMETRY_PERSIST_DEBOUNCE_MS)
    );
  }

  function handleResizeStart() {
    resizingRef.current = true;
  }

  function handleResizeEnd(itemId: string, width: number, height: number) {
    resizingRef.current = false;
    scheduleGeometryPersist(itemId, { width, height });
  }

  const loadStash = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    repositoryRef.current
      .getOrCreateStash()
      .then((loaded) => {
        applyStash(loaded);
        setError(null);
      })
      .catch((err) => {
        setLoadError(getStorageErrorMessage(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers = geometryTimersRef.current;
    const pending = pendingGeometryRef.current;

    repositoryRef.current
      .getOrCreateStash()
      .then((loaded) => {
        if (cancelled) return;
        applyStash(loaded);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(getStorageErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      pending.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onNodesChange(changes: NodeChange<StashFlowNode>[]) {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }

  function onNodeDragStop(_event: unknown, node: StashFlowNode) {
    scheduleGeometryPersist(node.id, {
      x: node.position.x,
      y: node.position.y,
    });
  }

  function onPaneClick(event: React.MouseEvent) {
    if (!stash) return;
    if (stash.items.length >= MAX_ITEMS_PER_STASH) {
      setError(
        getStorageErrorMessage(new StashItemsFullError(MAX_ITEMS_PER_STASH))
      );
      return;
    }
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

  function onNodeClick(_event: unknown, node: StashFlowNode) {
    if (resizingRef.current) return;
    setModalState({ mode: "edit", item: node.data.item });
  }

  function closeModal() {
    setModalState(null);
  }

  function handleSave(values: StashItemFormValues) {
    if (!stash || !modalState) return;
    if (modalState.mode === "create") {
      repositoryRef.current
        .createItem(stash, {
          ...values,
          x: modalState.position.x,
          y: modalState.position.y,
          width: DEFAULT_ITEM_WIDTH,
          height: DEFAULT_ITEM_HEIGHT,
        })
        .then(({ stash: updated }) => {
          applyStash(updated);
          setError(null);
          setModalState(null);
        })
        .catch(handleStorageError);
    } else {
      repositoryRef.current
        .updateItem(stash, modalState.item.id, values)
        .then((updated) => {
          applyStash(updated);
          setError(null);
          setModalState(null);
        })
        .catch(handleStorageError);
    }
  }

  function handleDelete() {
    if (!stash || modalState?.mode !== "edit") return;
    repositoryRef.current
      .deleteItem(stash, modalState.item.id)
      .then((updated) => {
        applyStash(updated);
        setError(null);
        setModalState(null);
      })
      .catch(handleStorageError);
  }

  if (loading) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin stroke-[1.5]" />
        <p className="font-mono text-xs uppercase tracking-widest">
          Loading your stash...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
        role="alert"
      >
        <AlertCircle className="h-8 w-8 stroke-[1.25] text-destructive" />
        <p className="max-w-sm font-mono text-sm leading-relaxed text-muted-foreground">
          {loadError}
        </p>
        <Button
          type="button"
          variant="outline"
          className="font-mono text-xs uppercase tracking-wide"
          onClick={loadStash}
        >
          Try again
        </Button>
      </div>
    );
  }

  const isFull = (stash?.items.length ?? 0) >= MAX_ITEMS_PER_STASH;

  return (
    <div className="relative h-full min-h-0 w-full flex-1">
      {error ? (
        <div
          className="absolute inset-x-0 top-0 z-20 flex items-start gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-3"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 stroke-[1.5] text-destructive" />
          <p className="flex-1 font-mono text-xs leading-relaxed text-destructive">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded p-0.5 text-destructive/70 hover:text-destructive"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <ReactFlow
        className="h-full w-full"
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        fitView={nodes.length > 0}
        minZoom={0.2}
        maxZoom={2}
        zoomOnScroll={false}
        panOnScroll
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
      >
        {bgVariant === "dots" ? (
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.4}
            color="var(--bg-dot-color)"
          />
        ) : (
          <Background
            variant={BackgroundVariant.Lines}
            gap={24}
            lineWidth={1}
            color="var(--bg-grid-color)"
          />
        )}
        <Panel position="top-left" className="p-0">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
            {statusLabel}
          </span>
        </Panel>
        <Panel position="bottom-left" className="flex flex-col gap-2 p-0">
          <CanvasButton onClick={() => zoomIn()} aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5 stroke-[1.5]" />
          </CanvasButton>
          <CanvasButton onClick={() => zoomOut()} aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5 stroke-[1.5]" />
          </CanvasButton>
          <CanvasButton
            onClick={() => fitView({ padding: 0.2 })}
            aria-label="Fit view"
          >
            <Scan className="h-3.5 w-3.5 stroke-[1.5]" />
          </CanvasButton>
          <CanvasButton
            onClick={toggleBg}
            aria-label={
              bgVariant === "dots" ? "Switch to grid" : "Switch to dots"
            }
          >
            {bgVariant === "dots" ? (
              <Grid2x2 className="h-3.5 w-3.5 stroke-[1.5]" />
            ) : (
              <Grip className="h-3.5 w-3.5 stroke-[1.5]" />
            )}
          </CanvasButton>
        </Panel>
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
      ) : isFull ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
          <p className="rounded-md border border-border/60 bg-background/90 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground shadow-sm">
            Stash full · delete an item to add more
          </p>
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

export function StashCanvas({
  repository = defaultStashRepository,
  statusLabel = ANON_STATUS_LABEL,
}: StashCanvasProps = {}) {
  return (
    <ReactFlowProvider>
      <StashCanvasInner repository={repository} statusLabel={statusLabel} />
    </ReactFlowProvider>
  );
}
