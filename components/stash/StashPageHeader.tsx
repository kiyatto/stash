"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HeaderLeft } from "@/components/layout/HeaderLeftSlot";
import { EditableStashName } from "@/components/stash/EditableStashName";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StashPageHeaderProps = {
  stashId: string;
  stashName: string;
};

export function StashPageHeader({ stashId, stashName }: StashPageHeaderProps) {
  return (
    <HeaderLeft>
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/stashes"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
          )}
        >
          <ArrowLeft className="stroke-[1.5]" />
          Stashes
        </Link>
        <EditableStashName
          key={`${stashId}-${stashName}`}
          stashId={stashId}
          initialName={stashName}
          className="min-w-0"
        />
      </div>
    </HeaderLeft>
  );
}
