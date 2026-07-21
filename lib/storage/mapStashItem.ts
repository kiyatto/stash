import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StashItemRow, StashRow } from "@/lib/supabase/database.types";
import { getStashImagePublicUrl } from "@/lib/storage/stashImages";
import type { Stash, StashItem } from "@/lib/types";

type Client = SupabaseClient<Database>;

/** Maps a stash_items row (or RPC-equivalent shape) into a StashItem. */
export function mapStashItemRow(row: StashItemRow, client: Client): StashItem {
  const imagePath = row.image_path ?? undefined;
  return {
    id: row.id,
    name: row.name,
    imagePath,
    imageDataUrl: imagePath
      ? getStashImagePublicUrl(client, imagePath, row.updated_at)
      : undefined,
    link: row.link ?? undefined,
    notes: row.notes ?? undefined,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStashRow(
  stashRow: StashRow,
  itemRows: StashItemRow[],
  client: Client
): Stash {
  return {
    id: stashRow.id,
    name: stashRow.name,
    items: itemRows.map((row) => mapStashItemRow(row, client)),
    createdAt: stashRow.created_at,
    updatedAt: stashRow.updated_at,
  };
}
