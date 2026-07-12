"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath);

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo.toString(),
        },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  if (status === "sent") {
    return (
      <div
        className="flex flex-col gap-3 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="font-serif text-xl italic text-foreground">
          Check your email
        </p>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          We sent a magic link to{" "}
          <span className="text-foreground">{email.trim()}</span>. Open it on
          this device to finish signing in.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 font-mono text-[10px] uppercase tracking-widest"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
        >
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={status === "loading"}
          className="font-mono text-sm"
        />
      </div>

      {errorMessage ? (
        <p
          className="font-mono text-xs leading-relaxed text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={status === "loading" || email.trim().length === 0}
        className="font-mono text-xs uppercase tracking-wide"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="animate-spin" data-icon="inline-start" />
            Sending link…
          </>
        ) : (
          "Send magic link"
        )}
      </Button>
    </form>
  );
}
