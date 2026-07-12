import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StashesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <PackageOpen className="h-10 w-10 stroke-[1.25] text-muted-foreground" />
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-serif text-3xl italic text-foreground">
          Your stashes
        </h1>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          Server persistence is ready. The force-graph stash list (create,
          open, rename) arrives in a later phase.
        </p>
      </div>
      <Link
        href="/settings"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "font-mono text-[10px] uppercase tracking-widest"
        )}
      >
        Open settings
      </Link>
    </div>
  );
}
