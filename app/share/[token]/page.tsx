import Link from "next/link";
import { Eye } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Eye className="h-10 w-10 stroke-[1.25] text-muted-foreground" />
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-serif text-3xl italic text-foreground">
          Shared stash
        </h1>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          Read-only share views (pan &amp; zoom only) arrive in a later phase.
          Token{" "}
          <span className="break-all text-foreground">{token}</span> is
          reserved for that public canvas.
        </p>
      </div>
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "font-mono text-[10px] uppercase tracking-widest"
        )}
      >
        Back home
      </Link>
    </div>
  );
}
