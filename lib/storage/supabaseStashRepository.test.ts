import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStashRepository } from "@/lib/storage/supabaseStashRepository";
import { StashNotFoundError } from "@/lib/storage/ownedStashes";
import { StashItemsFullError } from "@/lib/storage/stashRepository";
import {
  DEFAULT_ITEM_HEIGHT,
  DEFAULT_ITEM_WIDTH,
  MAX_ITEMS_PER_STASH,
} from "@/lib/types";
import { makeStash, makeStashItem } from "@/tests/helpers/fixtures";

vi.mock("@/lib/storage/stashImages", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/stashImages")>(
    "@/lib/storage/stashImages"
  );
  return {
    ...actual,
    uploadStashImage: vi.fn(async () => "user-1/stash-1/item-1.jpg"),
    removeStashImage: vi.fn(async () => undefined),
    getStashImagePublicUrl: (
      _client: unknown,
      path: string,
      version?: string | null
    ) => {
      const url = `https://example.supabase.co/storage/v1/object/public/stash-images/${path}`;
      if (!version) return url;
      return `${url}?v=${encodeURIComponent(version)}`;
    },
  };
});

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createClientMock(options: {
  stashRow?: Record<string, unknown> | null;
  itemRows?: Record<string, unknown>[];
  insertItem?: Record<string, unknown>;
  insertError?: { message: string } | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const stashRow =
    options.stashRow === undefined
      ? {
          id: "stash-1",
          owner_id: "user-1",
          name: "My Stash",
          share_token: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        }
      : options.stashRow;

  const itemRows = options.itemRows ?? [];

  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = self;
      builder.insert = self;
      builder.update = self;
      builder.delete = self;
      builder.eq = self;
      builder.order = async () => {
        if (table === "stash_items") {
          return { data: itemRows, error: null };
        }
        return { data: [], error: null };
      };
      builder.maybeSingle = async () => {
        if (table === "stashes") {
          return { data: stashRow, error: null };
        }
        return { data: null, error: null };
      };
      builder.single = async () => {
        if (table === "stash_items" && options.insertItem) {
          return {
            data: options.insertItem,
            error: options.insertError ?? null,
          };
        }
        return { data: null, error: { message: "unexpected single()" } };
      };
      // For update/delete that don't call maybeSingle/single
      builder.then = (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => {
        if (table === "stash_items") {
          return Promise.resolve({
            data: null,
            error: options.updateError ?? options.deleteError ?? null,
          }).then(resolve, reject);
        }
        if (table === "stashes") {
          return Promise.resolve({ data: null, error: null }).then(
            resolve,
            reject
          );
        }
        return Promise.resolve({ data: null, error: null }).then(
          resolve,
          reject
        );
      };
      return builder;
    },
  } as never;
}

describe("SupabaseStashRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads an owned stash with resolved image URLs", async () => {
    const client = createClientMock({
      itemRows: [
        {
          id: "item-1",
          stash_id: "stash-1",
          name: "Chair",
          image_path: "user-1/stash-1/item-1.jpg",
          link: null,
          notes: null,
          x: 10,
          y: 20,
          width: 220,
          height: 260,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    });

    const repo = createSupabaseStashRepository("stash-1", client);
    const stash = await repo.getOrCreateStash();

    expect(stash.id).toBe("stash-1");
    expect(stash.items).toHaveLength(1);
    expect(stash.items[0]!.imagePath).toBe("user-1/stash-1/item-1.jpg");
    expect(stash.items[0]!.imageDataUrl).toContain(
      "stash-images/user-1/stash-1/item-1.jpg"
    );
    expect(stash.items[0]!.imageDataUrl).toContain(
      `v=${encodeURIComponent("2026-07-01T00:00:00.000Z")}`
    );
  });

  it("throws StashNotFoundError when the stash is missing", async () => {
    const client = createClientMock({ stashRow: null });
    const repo = createSupabaseStashRepository("missing", client);

    await expect(repo.getOrCreateStash()).rejects.toBeInstanceOf(
      StashNotFoundError
    );
    await expect(repo.getStash()).resolves.toBeUndefined();
  });

  it("creates an item and uploads a data-URL image", async () => {
    const { uploadStashImage } = await import("@/lib/storage/stashImages");

    const inserted = {
      id: "item-new",
      stash_id: "stash-1",
      name: "Lamp",
      image_path: "user-1/stash-1/item-1.jpg",
      link: null,
      notes: null,
      x: 1,
      y: 2,
      width: DEFAULT_ITEM_WIDTH,
      height: DEFAULT_ITEM_HEIGHT,
      created_at: "2026-07-11T00:00:00.000Z",
      updated_at: "2026-07-11T00:00:00.000Z",
    };

    let loadCount = 0;
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: () => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.insert = self;
        builder.update = self;
        builder.eq = self;
        builder.order = async () => ({
          data: loadCount > 0 ? [inserted] : [],
          error: null,
        });
        builder.maybeSingle = async () => ({
          data: {
            id: "stash-1",
            owner_id: "user-1",
            name: "My Stash",
            share_token: null,
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-11T00:00:00.000Z",
          },
          error: null,
        });
        builder.single = async () => {
          loadCount += 1;
          return { data: inserted, error: null };
        };
        builder.then = (
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown
        ) => Promise.resolve({ data: null, error: null }).then(resolve, reject);
        return builder;
      },
    } as never;

    const repo = createSupabaseStashRepository("stash-1", client);
    const empty = makeStash({ id: "stash-1", items: [] });

    const { item, stash } = await repo.createItem(empty, {
      name: "Lamp",
      imageDataUrl: "data:image/jpeg;base64,abc",
      x: 1,
      y: 2,
      width: DEFAULT_ITEM_WIDTH,
      height: DEFAULT_ITEM_HEIGHT,
    });

    expect(uploadStashImage).toHaveBeenCalled();
    expect(item.name).toBe("Lamp");
    expect(stash.items).toHaveLength(1);
  });

  it("throws StashItemsFullError at the client-side limit", async () => {
    const client = createClientMock({});
    const repo = createSupabaseStashRepository("stash-1", client);
    const full = makeStash({
      id: "stash-1",
      items: Array.from({ length: MAX_ITEMS_PER_STASH }, (_, i) =>
        makeStashItem({ id: `item-${i}` })
      ),
    });

    await expect(
      repo.createItem(full, {
        name: "Overflow",
        x: 0,
        y: 0,
        width: DEFAULT_ITEM_WIDTH,
        height: DEFAULT_ITEM_HEIGHT,
      })
    ).rejects.toBeInstanceOf(StashItemsFullError);
  });
});
