import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeRedirectPath } from "@/lib/auth/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeRedirectPath(params.next);
  const authEnabled = isSupabaseConfigured();

  const errorMessage =
    params.error === "missing_code"
      ? "That sign-in link was incomplete. Request a new one."
      : params.error === "auth"
        ? "Sign-in failed. Request a new link and try again."
        : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-2 text-center">
          <h1 className="font-serif text-3xl italic text-foreground">
            Sign in
          </h1>
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            Enter your email and we&apos;ll send a link to login.
          </p>
        </div>

        {errorMessage ? (
          <p
            className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 font-mono text-xs leading-relaxed text-destructive"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        {authEnabled ? (
          <LoginForm nextPath={nextPath} />
        ) : (
          <div className="flex flex-col gap-4 text-center">
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              Auth isn&apos;t configured yet. Add your Supabase env vars to
              enable magic-link sign-in.
            </p>
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to canvas
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
