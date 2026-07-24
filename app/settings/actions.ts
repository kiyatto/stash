"use server";

import { redirect } from "next/navigation";
import { deleteUserAccount } from "@/lib/account/deleteAccount";
import {
  createAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteAccountAction(
  confirmationEmail: string
): Promise<DeleteAccountResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      error:
        "Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the server.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "You must be signed in to delete your account." };
  }

  const expected = (user.email ?? "").trim().toLowerCase();
  const provided = confirmationEmail.trim().toLowerCase();
  if (!expected || provided !== expected) {
    return {
      ok: false,
      error: "Type your account email exactly to confirm deletion.",
    };
  }

  try {
    const admin = createAdminClient();
    await deleteUserAccount(admin, user.id);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not delete account.",
    };
  }

  await supabase.auth.signOut();
  redirect("/");
}
