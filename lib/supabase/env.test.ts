import { afterEach, describe, expect, it, vi } from "vitest";

describe("isSupabaseConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns false when env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const { isSupabaseConfigured } = await import("@/lib/supabase/env");
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns true when URL and publishable key are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_example"
    );

    const { isSupabaseConfigured } = await import("@/lib/supabase/env");
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe("stash image object paths", () => {
  it("builds avatar and stash image storage paths", async () => {
    const { avatarObjectPath, stashImageObjectPath } = await import(
      "@/lib/supabase/constants"
    );

    expect(avatarObjectPath("user-1", "photo.webp")).toBe("user-1/photo.webp");
    expect(stashImageObjectPath("user-1", "stash-1", "item-1", "webp")).toBe(
      "user-1/stash-1/item-1.webp"
    );
  });
});
