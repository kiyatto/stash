import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/user";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl italic text-foreground">Settings</h1>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          Email and account deletion land in a later phase. Edit your display
          name and avatar from the stashes graph. You can sign out here.
        </p>
      </div>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Account
        </h2>
        <p className="font-mono text-sm text-foreground">
          {user?.email ?? "Signed in"}
        </p>
        <form action={signOut}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="font-mono text-[10px] uppercase tracking-widest"
          >
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
