import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/supabase/profile";
import { getCurrentUser } from "@/lib/supabase/user";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/settings");
  }

  const supabase = await createClient();
  const profile = await getOwnProfile(supabase);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl italic text-foreground">Settings</h1>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          Manage your profile, email, and account.
        </p>
      </div>

      <SettingsForm
        initialProfile={profile}
        email={user.email ?? ""}
      />
    </div>
  );
}
