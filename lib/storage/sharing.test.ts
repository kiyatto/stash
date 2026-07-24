import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSharePath,
  buildShareUrl,
  enableStashSharing,
  expiresAtFromPreset,
  getOwnedShareStatus,
  getOwnedShareToken,
  loadSharedStashByToken,
  revokeStashSharing,
  ShareNotFoundError,
  updateShareExpiry,
} from "@/lib/storage/sharing";
import { StashNotFoundError } from "@/lib/storage/ownedStashes";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createMockClient(handlers: {
  getUser?: () => Promise<{ data: { user: { id: string } | null }; error: null }>;
  from?: (table: string) => unknown;
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<QueryResult>;
}) {
  return {
    auth: {
      getUser:
        handlers.getUser ??
        (async () => ({ data: { user: { id: "user-1" } }, error: null })),
    },
    from: handlers.from ?? vi.fn(),
    rpc: handlers.rpc ?? vi.fn(),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/stash-images/${path}`,
          },
        }),
      }),
    },
  } as never;
}

describe("sharing helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds share paths and urls", () => {
    expect(buildSharePath("abc")).toBe("/share/abc");
    expect(buildShareUrl("https://stash.app/", "abc")).toBe(
      "https://stash.app/share/abc"
    );
  });

  it("maps expiry presets to absolute dates", () => {
    const from = new Date("2026-07-01T00:00:00.000Z");
    expect(expiresAtFromPreset("never", from)).toBeNull();
    expect(expiresAtFromPreset("7d", from)?.toISOString()).toBe(
      "2026-07-08T00:00:00.000Z"
    );
    expect(expiresAtFromPreset("30d", from)?.toISOString()).toBe(
      "2026-07-31T00:00:00.000Z"
    );
  });

  it("returns share status including expiry", async () => {
    const client = createMockClient({
      from: () => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.maybeSingle = async () => ({
          data: {
            share_token: "existing-token",
            share_expires_at: "2026-08-01T00:00:00.000Z",
          },
          error: null,
        });
        return builder;
      },
    });

    await expect(getOwnedShareStatus(client, "stash-1")).resolves.toEqual({
      token: "existing-token",
      expiresAt: "2026-08-01T00:00:00.000Z",
    });
    await expect(getOwnedShareToken(client, "stash-1")).resolves.toBe(
      "existing-token"
    );
  });

  it("throws when enabling share on a missing stash", async () => {
    const client = createMockClient({
      from: () => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.maybeSingle = async () => ({ data: null, error: null });
        return builder;
      },
    });

    await expect(enableStashSharing(client, "missing")).rejects.toBeInstanceOf(
      StashNotFoundError
    );
  });

  it("reuses an existing token when enabling share", async () => {
    let call = 0;
    const client = createMockClient({
      from: () => {
        call += 1;
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.update = self;
        if (call === 1) {
          builder.maybeSingle = async () => ({
            data: {
              share_token: "keep-me",
              share_expires_at: null,
            },
            error: null,
          });
        } else {
          builder.maybeSingle = async () => ({
            data: { share_token: "keep-me" },
            error: null,
          });
        }
        return builder;
      },
    });

    await expect(enableStashSharing(client, "stash-1")).resolves.toBe(
      "keep-me"
    );
  });

  it("creates a new token with expiry when enabling share", async () => {
    let call = 0;
    let updatedPayload: Record<string, unknown> | null = null;
    const client = createMockClient({
      from: () => {
        call += 1;
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.update = (payload: Record<string, unknown>) => {
          updatedPayload = payload;
          return builder;
        };
        if (call === 1) {
          builder.maybeSingle = async () => ({
            data: { share_token: null, share_expires_at: null },
            error: null,
          });
        } else {
          builder.maybeSingle = async () => ({
            data: { share_token: "generated-token" },
            error: null,
          });
        }
        return builder;
      },
    });

    const expiresAt = new Date("2026-07-30T00:00:00.000Z");
    const token = await enableStashSharing(client, "stash-1", { expiresAt });
    expect(token).toBe("generated-token");
    expect(updatedPayload).toMatchObject({
      share_expires_at: "2026-07-30T00:00:00.000Z",
    });
  });

  it("updates expiry without rotating the token", async () => {
    let call = 0;
    let updatedPayload: Record<string, unknown> | null = null;
    const client = createMockClient({
      from: () => {
        call += 1;
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = self;
        builder.eq = self;
        builder.update = (payload: Record<string, unknown>) => {
          updatedPayload = payload;
          return builder;
        };
        if (call === 1) {
          builder.maybeSingle = async () => ({
            data: {
              share_token: "tok",
              share_expires_at: null,
            },
            error: null,
          });
        } else {
          builder.maybeSingle = async () => ({
            data: {
              share_token: "tok",
              share_expires_at: "2026-08-01T00:00:00.000Z",
            },
            error: null,
          });
        }
        return builder;
      },
    });

    const status = await updateShareExpiry(
      client,
      "stash-1",
      new Date("2026-08-01T00:00:00.000Z")
    );
    expect(status.token).toBe("tok");
    expect(status.expiresAt).toBe("2026-08-01T00:00:00.000Z");
    expect(updatedPayload).toEqual({
      share_expires_at: "2026-08-01T00:00:00.000Z",
    });
  });

  it("revokes sharing by clearing the token and expiry", async () => {
    let updatedPayload: Record<string, unknown> | null = null;
    const client = createMockClient({
      from: () => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.update = (payload: Record<string, unknown>) => {
          updatedPayload = payload;
          return builder;
        };
        builder.eq = self;
        builder.select = self;
        builder.maybeSingle = async () => ({
          data: { id: "stash-1" },
          error: null,
        });
        return builder;
      },
    });

    await expect(
      revokeStashSharing(client, "stash-1")
    ).resolves.toBeUndefined();
    expect(updatedPayload).toEqual({
      share_token: null,
      share_expires_at: null,
    });
  });

  it("loads a shared stash via RPC", async () => {
    const client = createMockClient({
      rpc: async (fn) => {
        if (fn === "get_stash_by_share_token") {
          return {
            data: [
              {
                id: "stash-1",
                name: "Public stash",
                share_token: "tok",
                created_at: "2026-07-01T00:00:00.000Z",
                updated_at: "2026-07-02T00:00:00.000Z",
              },
            ],
            error: null,
          };
        }
        return {
          data: [
            {
              id: "item-1",
              stash_id: "stash-1",
              name: "Chair",
              image_path: "user/stash/item.jpg",
              link: null,
              notes: null,
              x: 1,
              y: 2,
              width: 220,
              height: 260,
              created_at: "2026-07-01T00:00:00.000Z",
              updated_at: "2026-07-01T00:00:00.000Z",
            },
          ],
          error: null,
        };
      },
    });

    const stash = await loadSharedStashByToken(client, "tok");
    expect(stash.name).toBe("Public stash");
    expect(stash.items).toHaveLength(1);
    expect(stash.items[0]!.imageDataUrl).toContain("stash-images/");
  });

  it("throws ShareNotFoundError for unknown tokens", async () => {
    const client = createMockClient({
      rpc: async () => ({ data: [], error: null }),
    });

    await expect(
      loadSharedStashByToken(client, "missing")
    ).rejects.toBeInstanceOf(ShareNotFoundError);
  });
});
