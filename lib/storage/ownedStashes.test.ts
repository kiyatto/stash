import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  StashLimitError,
  StashNotFoundError,
  createOwnedStash,
  deleteOwnedStash,
  listOwnedStashes,
  listStashCoverOptions,
  renameOwnedStash,
  setStashCoverImage,
} from "@/lib/storage/ownedStashes";
import { MAX_STASHES_PER_USER } from "@/lib/supabase/constants";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

function createMockClient(handlers: {
  getUser?: () => Promise<{ data: { user: { id: string } | null }; error: null }>;
  from?: (table: string) => unknown;
  storage?: unknown;
}) {
  return {
    auth: {
      getUser:
        handlers.getUser ??
        (async () => ({ data: { user: { id: "user-1" } }, error: null })),
    },
    from: handlers.from ?? vi.fn(),
    storage: handlers.storage ?? {
      from: () => ({
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.test/${path}` },
        }),
      }),
    },
  } as never;
}

describe("ownedStashes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists stashes using the first item that has an image", async () => {
    const rows = [
      {
        id: "s1",
        owner_id: "user-1",
        name: "Alpha",
        share_token: null,
        share_expires_at: null,
        cover_image_path: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
        stash_items: [{ count: 2 }],
      },
    ];

    const listClient = createMockClient({
      from: (table: string) => {
        if (table === "stash_items") {
          const builder: Record<string, unknown> = {};
          const self = () => builder;
          builder.select = self;
          builder.in = self;
          builder.not = self;
          builder.order = async () => ({
            data: [
              {
                stash_id: "s1",
                image_path: "user-1/s1/item-early.jpg",
                updated_at: "2026-07-01T12:00:00.000Z",
                created_at: "2026-07-01T10:00:00.000Z",
              },
              {
                stash_id: "s1",
                image_path: "user-1/s1/item-late.jpg",
                updated_at: "2026-07-02T12:00:00.000Z",
                created_at: "2026-07-02T10:00:00.000Z",
              },
            ],
            error: null,
          });
          return builder;
        }

        const result = { data: rows, error: null };
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.order = async () => result;
        return builder;
      },
    });

    const stashes = await listOwnedStashes(listClient);
    expect(stashes).toEqual([
      {
        id: "s1",
        name: "Alpha",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
        itemCount: 2,
        coverImagePath: null,
        previewImageUrl:
          "https://example.test/user-1/s1/item-early.jpg?v=2026-07-01T12%3A00%3A00.000Z",
      },
    ]);
  });

  it("skips earliest items without images when resolving the default cover", async () => {
    const rows = [
      {
        id: "s1",
        owner_id: "user-1",
        name: "Alpha",
        share_token: null,
        share_expires_at: null,
        cover_image_path: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
        stash_items: [{ count: 2 }],
      },
    ];

    const listClient = createMockClient({
      from: (table: string) => {
        if (table === "stash_items") {
          const builder: Record<string, unknown> = {};
          const self = () => builder;
          builder.select = self;
          builder.in = self;
          builder.not = self;
          builder.order = async () => ({
            data: [
              {
                stash_id: "s1",
                image_path: "user-1/s1/item-late.jpg",
                updated_at: "2026-07-02T12:00:00.000Z",
                created_at: "2026-07-02T10:00:00.000Z",
              },
            ],
            error: null,
          });
          return builder;
        }

        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.order = async () => ({ data: rows, error: null });
        return builder;
      },
    });

    const stashes = await listOwnedStashes(listClient);
    expect(stashes[0]?.previewImageUrl).toBe(
      "https://example.test/user-1/s1/item-late.jpg?v=2026-07-02T12%3A00%3A00.000Z"
    );
  });

  it("prefers an explicit cover_image_path over auto preview", async () => {
    const rows = [
      {
        id: "s1",
        owner_id: "user-1",
        name: "Alpha",
        share_token: null,
        share_expires_at: null,
        cover_image_path: "user-1/s1/chosen.jpg",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
        stash_items: [{ count: 2 }],
      },
    ];

    const listClient = createMockClient({
      from: (table: string) => {
        if (table === "stash_items") {
          throw new Error("should not query items when cover is set");
        }
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.order = async () => ({ data: rows, error: null });
        return builder;
      },
    });

    const stashes = await listOwnedStashes(listClient);
    expect(stashes[0]?.previewImageUrl).toBe(
      "https://example.test/user-1/s1/chosen.jpg?v=2026-07-02T00%3A00%3A00.000Z"
    );
  });

  it("lists cover options from item images", async () => {
    const client = createMockClient({
      from: (table: string) => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.not = self;
        builder.order = async () => ({
          data:
            table === "stash_items"
              ? [
                  {
                    id: "item-1",
                    name: "Lamp",
                    image_path: "user-1/s1/a.jpg",
                    updated_at: "2026-07-01T00:00:00.000Z",
                  },
                ]
              : null,
          error: null,
        });
        builder.maybeSingle = async () => ({
          data: table === "stashes" ? { id: "s1" } : null,
          error: null,
        });
        return builder;
      },
    });

    const options = await listStashCoverOptions(client, "s1");
    expect(options).toEqual([
      {
        itemId: "item-1",
        imagePath: "user-1/s1/a.jpg",
        imageUrl:
          "https://example.test/user-1/s1/a.jpg?v=2026-07-01T00%3A00%3A00.000Z",
        name: "Lamp",
      },
    ]);
  });

  it("sets and clears a stash cover image", async () => {
    let call = 0;
    const client = createMockClient({
      from: (table: string) => {
        call += 1;
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.not = self;
        builder.in = self;
        builder.update = self;
        builder.order = async () => ({ data: [], error: null });
        if (table === "stash_items" && call === 1) {
          builder.maybeSingle = async () => ({
            data: { id: "item-1", image_path: "user-1/s1/a.jpg" },
            error: null,
          });
        } else {
          builder.maybeSingle = async () => ({
            data: {
              id: "s1",
              owner_id: "user-1",
              name: "Alpha",
              share_token: null,
              share_expires_at: null,
              cover_image_path:
                call <= 2 ? "user-1/s1/a.jpg" : null,
              created_at: "2026-07-01T00:00:00.000Z",
              updated_at: "2026-07-02T00:00:00.000Z",
              stash_items: [{ count: 1 }],
            },
            error: null,
          });
        }
        return builder;
      },
    });

    const withCover = await setStashCoverImage(
      client,
      "s1",
      "user-1/s1/a.jpg"
    );
    expect(withCover.coverImagePath).toBe("user-1/s1/a.jpg");
    expect(withCover.previewImageUrl).toContain("user-1/s1/a.jpg");

    const cleared = await setStashCoverImage(client, "s1", null);
    expect(cleared.coverImagePath).toBeNull();
  });

  it("throws StashLimitError when the user is at capacity", async () => {
    const client = createMockClient({
      from: () => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.then = (
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown
        ) =>
          Promise.resolve({
            data: null,
            error: null,
            count: MAX_STASHES_PER_USER,
          }).then(resolve, reject);
        return builder;
      },
    });

    await expect(createOwnedStash(client)).rejects.toBeInstanceOf(
      StashLimitError
    );
  });

  it("creates a stash when under the limit", async () => {
    let call = 0;
    const created = {
      id: "new-stash",
      owner_id: "user-1",
      name: "My Stash",
      share_token: null,
      share_expires_at: null,
      cover_image_path: null,
      created_at: "2026-07-11T00:00:00.000Z",
      updated_at: "2026-07-11T00:00:00.000Z",
    };

    const client = createMockClient({
      from: () => {
        call += 1;
        if (call === 1) {
          const builder: Record<string, unknown> = {};
          const self = () => builder;
          builder.select = self;
          builder.eq = self;
          builder.then = (
            resolve: (value: QueryResult) => unknown,
            reject?: (reason: unknown) => unknown
          ) =>
            Promise.resolve({ data: null, error: null, count: 0 }).then(
              resolve,
              reject
            );
          return builder;
        }

        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.insert = self;
        builder.select = self;
        builder.single = async () => ({ data: created, error: null });
        return builder;
      },
    });

    const stash = await createOwnedStash(client);
    expect(stash.id).toBe("new-stash");
    expect(stash.name).toBe("My Stash");
  });

  it("throws StashNotFoundError when renaming a missing stash", async () => {
    const client = createMockClient({
      from: () => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.update = self;
        builder.eq = self;
        builder.select = self;
        builder.maybeSingle = async () => ({ data: null, error: null });
        return builder;
      },
    });

    await expect(
      renameOwnedStash(client, "missing", "New name")
    ).rejects.toBeInstanceOf(StashNotFoundError);
  });

  it("throws StashNotFoundError when deleting a missing stash", async () => {
    const client = createMockClient({
      from: () => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.delete = self;
        builder.eq = self;
        builder.select = self;
        builder.maybeSingle = async () => ({ data: null, error: null });
        return builder;
      },
    });

    await expect(deleteOwnedStash(client, "missing")).rejects.toBeInstanceOf(
      StashNotFoundError
    );
  });
});
