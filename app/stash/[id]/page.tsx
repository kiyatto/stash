import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OwnedStashCanvas } from "@/components/canvas/OwnedStashCanvas";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { cn } from "@/lib/utils";

type StashPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StashPage({ params }: StashPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const supabase = await createClient();
  const { data: stash, error } = await supabase
    .from("stashes")
    .select("id, name")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !stash) {
    notFound();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-2">
        <Link
          href="/stashes"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
          )}
        >
          <ArrowLeft className="stroke-[1.5]" />
          Stashes
        </Link>
        <h1 className="truncate font-serif text-lg italic text-foreground">
          {stash.name}
        </h1>
      </div>
      <OwnedStashCanvas stashId={stash.id} />
    </div>
  );
}
