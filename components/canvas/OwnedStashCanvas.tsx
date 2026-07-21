"use client";

import { StashCanvas } from "@/components/canvas/StashCanvas";
import { createSupabaseStashRepository } from "@/lib/storage/supabaseStashRepository";

type OwnedStashCanvasProps = {
  stashId: string;
};

export function OwnedStashCanvas({ stashId }: OwnedStashCanvasProps) {
  return (
    <StashCanvas
      key={stashId}
      repository={createSupabaseStashRepository(stashId)}
      statusLabel="Saved to your account"
      shareStashId={stashId}
    />
  );
}
