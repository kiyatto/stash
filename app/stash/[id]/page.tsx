import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StashPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StashPage({ params }: StashPageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Stash
        </p>
        <h1 className="font-serif text-3xl italic text-foreground">
          Owner canvas
        </h1>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          This route is reserved for stash{" "}
          <span className="text-foreground">{id}</span>. The editable
          server-backed canvas lands with server persistence.
        </p>
      </div>
      <Link
        href="/stashes"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "font-mono text-[10px] uppercase tracking-widest"
        )}
      >
        <ArrowLeft className="stroke-[1.5]" />
        Back to stashes
      </Link>
    </div>
  );
}
