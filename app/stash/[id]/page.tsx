import { notFound } from "next/navigation";
import { OwnedStashCanvas } from "@/components/canvas/OwnedStashCanvas";
import { StashPageHeader } from "@/components/stash/StashPageHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

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
      <StashPageHeader stashId={stash.id} stashName={stash.name} />
      <OwnedStashCanvas stashId={stash.id} />
    </div>
  );
}
