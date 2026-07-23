import { StashesHome } from "@/components/stashes/StashesHome";

// Requires a browser Supabase client; skip static prerender so CI builds
// without NEXT_PUBLIC_SUPABASE_* still succeed.
export const dynamic = "force-dynamic";

export default function StashesPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <StashesHome />
    </div>
  );
}
