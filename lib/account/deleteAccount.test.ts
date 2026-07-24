import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUserAccount } from "@/lib/account/deleteAccount";

describe("deleteUserAccount", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("removes storage folders and deletes the auth user", async () => {
    const remove = vi.fn(async () => ({ error: null }));
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: "file-1", name: "avatar.jpg" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: null, name: "stash-1" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: "file-2", name: "item.jpg" }],
        error: null,
      });

    const deleteUser = vi.fn(async () => ({ error: null }));

    const admin = {
      storage: {
        from: () => ({ list, remove }),
      },
      auth: {
        admin: { deleteUser },
      },
    } as never;

    await deleteUserAccount(admin, "user-1");

    expect(remove).toHaveBeenCalledWith(["user-1/avatar.jpg"]);
    expect(remove).toHaveBeenCalledWith(["user-1/stash-1/item.jpg"]);
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("still deletes the auth user if storage cleanup fails", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const admin = {
      storage: {
        from: () => ({
          list: async () => ({ data: null, error: { message: "boom" } }),
          remove: async () => ({ error: null }),
        }),
      },
      auth: {
        admin: { deleteUser },
      },
    } as never;

    await expect(deleteUserAccount(admin, "user-1")).resolves.toBeUndefined();
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("throws when auth delete fails", async () => {
    const admin = {
      storage: {
        from: () => ({
          list: async () => ({ data: [], error: null }),
          remove: async () => ({ error: null }),
        }),
      },
      auth: {
        admin: {
          deleteUser: async () => ({ error: { message: "nope" } }),
        },
      },
    } as never;

    await expect(deleteUserAccount(admin, "user-1")).rejects.toThrow(
      "Failed to delete account: nope"
    );
  });
});
