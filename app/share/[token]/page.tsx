import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { SharedStashCanvas } from "@/components/canvas/SharedStashCanvas";
import { HeaderLeft } from "@/components/layout/HeaderLeftSlot";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  loadSharedStashByToken,
  ShareNotFoundError,
} from "@/lib/storage/sharing";
import { cn } from "@/lib/utils";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <Eye className="h-10 w-10 stroke-[1.25] text-muted-foreground" />
        <div className="flex max-w-md flex-col gap-2">
          <h1 className="font-serif text-3xl italic text-foreground">
            Shared stash
          </h1>
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            Sharing requires Supabase to be configured.
          </p>
        </div>
      </div>
    );
  }

  let stash;
  try {
    const supabase = await createClient();
    stash = await loadSharedStashByToken(supabase, token);
  } catch (error) {
    if (error instanceof ShareNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <HeaderLeft>
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Shared
          </span>
          <h1 className="truncate font-serif text-lg italic text-foreground">
            {stash.name}
          </h1>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            )}
          >
            Open stash
          </Link>
        </div>
      </HeaderLeft>
      <SharedStashCanvas stash={stash} />
    </div>
  );
}
