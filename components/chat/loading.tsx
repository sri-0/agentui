"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Glowing gradient orb — the AI "thinking" indicator. */
export function GradientOrb({ className }: { className?: string }) {
  return <span className={cn("ai-orb block size-5", className)} aria-hidden />;
}

/** Shown while waiting for the first token / between turns. */
export function ThinkingIndicator({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <GradientOrb />
      <Shimmer className="text-sm" duration={1.6}>
        {`${label}…`}
      </Shimmer>
    </div>
  );
}

/** Skeleton placeholder while a saved thread's history loads. */
export function ConversationSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
      <div className="ml-auto flex w-2/3 flex-col items-end gap-2">
        <Skeleton className="h-9 w-3/4 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <GradientOrb className="size-5" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-[90%]" />
        <Skeleton className="h-3 w-[78%]" />
        <Skeleton className="h-3 w-[84%]" />
      </div>
    </div>
  );
}
