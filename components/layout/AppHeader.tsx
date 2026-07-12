import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/user";
import { cn } from "@/lib/utils";

const navLinkClass = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
);

export async function AppHeader() {
  const user = await getCurrentUser();
  const authEnabled = isSupabaseConfigured();
  const homeHref = user ? "/stashes" : "/";

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-4">
      <Link
        href={homeHref}
        className="font-serif text-base italic text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        stash
      </Link>

      <nav className="flex items-center gap-1">
        <Link href="/settings" className={navLinkClass}>
          Settings
        </Link>
        {user ? (
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Sign out
            </Button>
          </form>
        ) : authEnabled ? (
          <Link href="/login" className={navLinkClass}>
            Sign in
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
