"use client";

import { StashCanvas } from "@/components/canvas/StashCanvas";
import { createReadOnlyStashRepository } from "@/lib/storage/readOnlyStashRepository";
import type { Stash } from "@/lib/types";

type SharedStashCanvasProps = {
  stash: Stash;
};

export function SharedStashCanvas({ stash }: SharedStashCanvasProps) {
  return (
    <StashCanvas
      key={stash.id}
      repository={createReadOnlyStashRepository(stash)}
      readOnly
      statusLabel="View only · shared link"
    />
  );
}
