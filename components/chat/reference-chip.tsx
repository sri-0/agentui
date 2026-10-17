import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * A reference in a text, in the text's font and size: its icon and its name
 * on a tint, so it reads in the sentence. The composer's chips and the sent
 * message's are this one.
 */
export function ReferenceChip({ icon, className, children }: { icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <span
      data-slot="reference-chip"
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 align-baseline leading-tight whitespace-nowrap text-secondary-foreground [&>svg]:size-[1em] [&>svg]:shrink-0",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
