import { StashCanvas } from "@/components/canvas/StashCanvas";

export default function Home() {
  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border/50 bg-background px-6 py-3">
        <span className="font-serif text-lg italic text-muted-foreground">
          Stash
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Unsaved changes kept for 7 days
        </span>
      </header>
      <StashCanvas />
    </div>
  );
}
