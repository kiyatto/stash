import { v4 as uuidv4 } from "uuid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database, StashItemRow, StashRow } from "@/lib/supabase/database.types";
import { requireUserId } from "@/lib/supabase/requireUserId";
import {
  StashItemsFullError,
  type StashRepository,
} from "@/lib/storage/stashRepository";
import { mapStashItemRow, mapStashRow } from "@/lib/storage/mapStashItem";
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

const AUTH_MESSAGE = "You must be signed in to edit this stash.";

function isItemLimitError(message: string): boolean {
  return /stash item limit reached/i.test(message);
}

function withTouchedStash(
  stash: Stash,
  stashRow: StashRow | undefined,
  items: StashItem[]
): Stash {
  return {
    ...stash,
    items,
    updatedAt: stashRow?.updated_at ?? new Date().toISOString(),
  };
}

class SupabaseStashRepository implements StashRepository {
  private cachedUserId: string | null = null;

  constructor(
    private readonly stashId: string,
    private readonly client: Client
  ) {}

  private async getUserId(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId;
    this.cachedUserId = await requireUserId(this.client, AUTH_MESSAGE);
    return this.cachedUserId;
  }

  private async loadStashRow(userId?: string): Promise<StashRow | undefined> {
    const ownerId = userId ?? (await this.getUserId());

    const { data, error } = await this.client
      .from("stashes")
      .select("*")
      .eq("id", this.stashId)
      .eq("owner_id", ownerId)
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

  private async touchStashUpdatedAt(): Promise<StashRow> {
    const { data, error } = await this.client
      .from("stashes")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", this.stashId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update stash: ${error.message}`);
    }
    if (!data) {
      throw new StashNotFoundError(this.stashId);
    }
    return data;
  }

  async getStash(): Promise<Stash | undefined> {
    const stashRow = await this.loadStashRow();
    if (!stashRow) return undefined;
    const items = await this.loadItems();
    return mapStashRow(stashRow, items, this.client);
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
    const userId = await this.getUserId();

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

    return {
      ...stash,
      name: data.name,
      updatedAt: data.updated_at,
    };
  }

  async touchStash(stash: Stash): Promise<Stash> {
    const stashRow = await this.touchStashUpdatedAt();
    return { ...stash, updatedAt: stashRow.updated_at };
  }

  async createItem(
    stash: Stash,
    data: CreateItemInput
  ): Promise<{ stash: Stash; item: StashItem }> {
    if (stash.items.length >= MAX_ITEMS_PER_STASH) {
      throw new StashItemsFullError(MAX_ITEMS_PER_STASH);
    }

    const userId = await this.getUserId();
    const itemId = uuidv4();

    let imagePath: string | null = null;
    if (isDataUrl(data.imageDataUrl)) {
      imagePath = await uploadStashImage(
        this.client,
        userId,
        this.stashId,
        itemId,
        data.imageDataUrl
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

    const stashRow = await this.touchStashUpdatedAt();
    const item = mapStashItemRow(row, this.client);
    return {
      stash: withTouchedStash(stash, stashRow, [...stash.items, item]),
      item,
    };
  }

  async updateItem(
    stash: Stash,
    itemId: string,
    updates: UpdateItemInput
  ): Promise<Stash> {
    const userId = await this.getUserId();
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
    let nextImagePath = existing.imagePath;

    if ("imageDataUrl" in updates) {
      if (isDataUrl(updates.imageDataUrl)) {
        uploadedPath = await uploadStashImage(
          this.client,
          userId,
          this.stashId,
          itemId,
          updates.imageDataUrl
        );
        patch.image_path = uploadedPath;
        nextImagePath = uploadedPath;
        shouldRemoveOld =
          Boolean(existing.imagePath) && existing.imagePath !== uploadedPath;
      } else if (!updates.imageDataUrl) {
        patch.image_path = null;
        nextImagePath = undefined;
        shouldRemoveOld = Boolean(existing.imagePath);
      }
      // http(s) public URL → keep existing image_path (no patch)
    }

    let updatedRow: StashItemRow | null = null;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await this.client
        .from("stash_items")
        .update(patch)
        .eq("id", itemId)
        .eq("stash_id", this.stashId)
        .select("*")
        .maybeSingle();

      if (error) {
        if (uploadedPath) {
          await removeStashImage(this.client, uploadedPath).catch(
            () => undefined
          );
        }
        throw new Error(`Failed to update item: ${error.message}`);
      }
      updatedRow = data;
    }

    if (shouldRemoveOld && existing.imagePath) {
      await removeStashImage(this.client, existing.imagePath).catch(
        () => undefined
      );
    }

    const stashRow = await this.touchStashUpdatedAt();
    const nextItem: StashItem = updatedRow
      ? mapStashItemRow(updatedRow, this.client)
      : {
          ...existing,
          ...updates,
          imagePath: nextImagePath,
          imageDataUrl: nextImagePath
            ? getStashImagePublicUrl(
                this.client,
                nextImagePath,
                stashRow.updated_at
              )
            : updates.imageDataUrl === undefined
              ? existing.imageDataUrl
              : updates.imageDataUrl || undefined,
          updatedAt: stashRow.updated_at,
        };

    return withTouchedStash(
      stash,
      stashRow,
      stash.items.map((item) => (item.id === itemId ? nextItem : item))
    );
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

    const stashRow = await this.touchStashUpdatedAt();
    return withTouchedStash(
      stash,
      stashRow,
      stash.items.filter((item) => item.id !== itemId)
    );
  }
}

export function createSupabaseStashRepository(
  stashId: string,
  client: Client = createClient()
): StashRepository {
  return new SupabaseStashRepository(stashId, client);
}
