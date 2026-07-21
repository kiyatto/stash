import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Resolves the signed-in user id or throws with a caller-provided message. */
export async function requireUserId(
  client: Client,
  message = "You must be signed in."
): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error(message);
  }

  return user.id;
}
