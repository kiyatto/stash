const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseUrl(): string {
  if (!SUPABASE_URL) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Find it in Supabase Dashboard → Project Settings → API (Project URL), or the Connect dialog."
    );
  }
  return SUPABASE_URL;
}

export function getSupabasePublishableKey(): string {
  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Set it in .env.local from Supabase Dashboard → Project Settings → API Keys (sb_publishable_...)."
    );
  }
  return SUPABASE_PUBLISHABLE_KEY;
}
