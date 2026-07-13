import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  StashLimitError,
  StashNotFoundError,
  createOwnedStash,
  deleteOwnedStash,
  listOwnedStashes,
  renameOwnedStash,
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
      }),
    },
  } as never;
}

describe("ownedStashes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists stashes for the current user", async () => {
    const rows = [
      {
        id: "s1",
        owner_id: "user-1",
        name: "Alpha",
        share_token: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
      },
    ];

    const listClient = createMockClient({
      from: () => {
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
        itemCount: 0,
      },
    ]);
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
