"use client";

import { useMemo } from "react";
import { StashCanvas } from "@/components/canvas/StashCanvas";
import { createSupabaseStashRepository } from "@/lib/storage/supabaseStashRepository";

type OwnedStashCanvasProps = {
  stashId: string;
};

export function OwnedStashCanvas({ stashId }: OwnedStashCanvasProps) {
  const repository = useMemo(
    () => createSupabaseStashRepository(stashId),
    [stashId]
  );

  return (
    <StashCanvas
      key={stashId}
      repository={repository}
      statusLabel="Saved to your account"
      shareStashId={stashId}
    />
  );
}
