const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

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

/** Server-only. Used for cron/admin tasks in later phases. Never expose to the browser. */
export function getSupabaseSecretKey(): string {
  if (!SUPABASE_SECRET_KEY) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY. Required for server-side admin operations only."
    );
  }
  return SUPABASE_SECRET_KEY;
}
