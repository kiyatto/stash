"use client";

import { useMemo } from "react";
import { StashCanvas } from "@/components/canvas/StashCanvas";
import { createReadOnlyStashRepository } from "@/lib/storage/readOnlyStashRepository";
import type { Stash } from "@/lib/types";

type SharedStashCanvasProps = {
  stash: Stash;
};

export function SharedStashCanvas({ stash }: SharedStashCanvasProps) {
  const repository = useMemo(
    () => createReadOnlyStashRepository(stash),
    [stash]
  );

  return (
    <StashCanvas
      key={stash.id}
      repository={repository}
      readOnly
      statusLabel="View only · shared link"
    />
  );
}
