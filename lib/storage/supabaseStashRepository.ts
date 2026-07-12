import { v4 as uuidv4 } from "uuid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database, StashItemRow, StashRow } from "@/lib/supabase/database.types";
import {
  StashItemsFullError,
  type StashRepository,
} from "@/lib/storage/stashRepository";
import { StashNotFoundError } from "@/lib/storage/ownedStashes";
import {
  getStashImagePublicUrl,
  isDataUrl,
  removeStashImage,
  uploadStashImage,
} from "@/lib/storage/stashImages";
import type {
  CreateItemInput,
  Stash,
  StashItem,
  UpdateItemInput,
} from "@/lib/types";
import { MAX_ITEMS_PER_STASH } from "@/lib/types";

type Client = SupabaseClient<Database>;

function mapItem(row: StashItemRow, client: Client): StashItem {
  const imagePath = row.image_path ?? undefined;
  return {
    id: row.id,
    name: row.name,
    imagePath,
    imageDataUrl: imagePath
      ? getStashImagePublicUrl(client, imagePath)
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

function mapStash(
  stashRow: StashRow,
  itemRows: StashItemRow[],
  client: Client
): Stash {
  return {
    id: stashRow.id,
    name: stashRow.name,
    items: itemRows.map((row) => mapItem(row, client)),
    createdAt: stashRow.created_at,
    updatedAt: stashRow.updated_at,
  };
}

function isItemLimitError(message: string): boolean {
  return /stash item limit reached/i.test(message);
}

class SupabaseStashRepository implements StashRepository {
  constructor(
    private readonly stashId: string,
    private readonly client: Client
  ) {}

  private async requireUserId(): Promise<string> {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();

    if (error || !user) {
      throw new Error("You must be signed in to edit this stash.");
    }

    return user.id;
  }

  private async loadStashRow(): Promise<StashRow | undefined> {
    const userId = await this.requireUserId();

    const { data, error } = await this.client
      .from("stashes")
      .select("*")
      .eq("id", this.stashId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load stash: ${error.message}`);
    }

    return data ?? undefined;
  }

  private async loadItems(): Promise<StashItemRow[]> {
    const { data, error } = await this.client
      .from("stash_items")
      .select("*")
      .eq("stash_id", this.stashId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load stash items: ${error.message}`);
    }

    return data ?? [];
  }

  private async touchStashUpdatedAt(): Promise<void> {
    const { error } = await this.client
      .from("stashes")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", this.stashId);

    if (error) {
      throw new Error(`Failed to update stash: ${error.message}`);
    }
  }

  async getStash(): Promise<Stash | undefined> {
    const stashRow = await this.loadStashRow();
    if (!stashRow) return undefined;
    const items = await this.loadItems();
    return mapStash(stashRow, items, this.client);
  }

  /**
   * Loads an existing owned stash. Unlike the IndexedDB implementation,
   * this never creates a stash — callers must use `createOwnedStash` first.
   */
  async getOrCreateStash(): Promise<Stash> {
    const stash = await this.getStash();
    if (!stash) {
      throw new StashNotFoundError(this.stashId);
    }
    return stash;
  }

  async saveStash(stash: Stash): Promise<Stash> {
    const userId = await this.requireUserId();

    const { data, error } = await this.client
      .from("stashes")
      .update({ name: stash.name })
      .eq("id", this.stashId)
      .eq("owner_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to save stash: ${error.message}`);
    }
    if (!data) {
      throw new StashNotFoundError(this.stashId);
    }

    const items = await this.loadItems();
    return mapStash(data, items, this.client);
  }

  async touchStash(stash: Stash): Promise<Stash> {
    await this.touchStashUpdatedAt();
    const reloaded = await this.getStash();
    if (!reloaded) {
      throw new StashNotFoundError(this.stashId);
    }
    return { ...reloaded, name: stash.name };
  }

  async createItem(
    stash: Stash,
    data: CreateItemInput
  ): Promise<{ stash: Stash; item: StashItem }> {
    if (stash.items.length >= MAX_ITEMS_PER_STASH) {
      throw new StashItemsFullError(MAX_ITEMS_PER_STASH);
    }

    const userId = await this.requireUserId();
    const itemId = uuidv4();

    let imagePath: string | null = null;
    if (isDataUrl(data.imageDataUrl)) {
      imagePath = await uploadStashImage(
        this.client,
        userId,
        this.stashId,
        itemId,
        data.imageDataUrl!
      );
    }

    const { data: row, error } = await this.client
      .from("stash_items")
      .insert({
        id: itemId,
        stash_id: this.stashId,
        name: data.name ?? "",
        image_path: imagePath,
        link: data.link || null,
        notes: data.notes || null,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
      })
      .select("*")
      .single();

    if (error) {
      if (imagePath) {
        await removeStashImage(this.client, imagePath).catch(() => undefined);
      }
      if (isItemLimitError(error.message)) {
        throw new StashItemsFullError(MAX_ITEMS_PER_STASH);
      }
      throw new Error(`Failed to create item: ${error.message}`);
    }

    await this.touchStashUpdatedAt();

    const item = mapItem(row, this.client);
    const stashRow = await this.loadStashRow();
    if (!stashRow) {
      throw new StashNotFoundError(this.stashId);
    }
    const items = await this.loadItems();
    return { stash: mapStash(stashRow, items, this.client), item };
  }

  async updateItem(
    stash: Stash,
    itemId: string,
    updates: UpdateItemInput
  ): Promise<Stash> {
    const userId = await this.requireUserId();
    const existing = stash.items.find((item) => item.id === itemId);
    if (!existing) {
      throw new Error(`Item not found (${itemId})`);
    }

    const patch: Database["public"]["Tables"]["stash_items"]["Update"] = {};

    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.link !== undefined) patch.link = updates.link || null;
    if (updates.notes !== undefined) patch.notes = updates.notes || null;
    if (updates.x !== undefined) patch.x = updates.x;
    if (updates.y !== undefined) patch.y = updates.y;
    if (updates.width !== undefined) patch.width = updates.width;
    if (updates.height !== undefined) patch.height = updates.height;

    let uploadedPath: string | null = null;
    let shouldRemoveOld = false;

    if ("imageDataUrl" in updates) {
      if (isDataUrl(updates.imageDataUrl)) {
        uploadedPath = await uploadStashImage(
          this.client,
          userId,
          this.stashId,
          itemId,
          updates.imageDataUrl!
        );
        patch.image_path = uploadedPath;
        shouldRemoveOld =
          Boolean(existing.imagePath) && existing.imagePath !== uploadedPath;
      } else if (!updates.imageDataUrl) {
        patch.image_path = null;
        shouldRemoveOld = Boolean(existing.imagePath);
      }
      // http(s) public URL → keep existing image_path (no patch)
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await this.client
        .from("stash_items")
        .update(patch)
        .eq("id", itemId)
        .eq("stash_id", this.stashId);

      if (error) {
        if (uploadedPath) {
          await removeStashImage(this.client, uploadedPath).catch(
            () => undefined
          );
        }
        throw new Error(`Failed to update item: ${error.message}`);
      }
    }

    if (shouldRemoveOld && existing.imagePath) {
      await removeStashImage(this.client, existing.imagePath).catch(
        () => undefined
      );
    }

    await this.touchStashUpdatedAt();

    const reloaded = await this.getStash();
    if (!reloaded) {
      throw new StashNotFoundError(this.stashId);
    }
    return reloaded;
  }

  async deleteItem(stash: Stash, itemId: string): Promise<Stash> {
    const existing = stash.items.find((item) => item.id === itemId);

    const { error } = await this.client
      .from("stash_items")
      .delete()
      .eq("id", itemId)
      .eq("stash_id", this.stashId);

    if (error) {
      throw new Error(`Failed to delete item: ${error.message}`);
    }

    if (existing?.imagePath) {
      await removeStashImage(this.client, existing.imagePath).catch(
        () => undefined
      );
    }

    await this.touchStashUpdatedAt();

    const reloaded = await this.getStash();
    if (!reloaded) {
      throw new StashNotFoundError(this.stashId);
    }
    return reloaded;
  }
}

export function createSupabaseStashRepository(
  stashId: string,
  client: Client = createClient()
): StashRepository {
  return new SupabaseStashRepository(stashId, client);
}
