import type { ReactNode } from "react";

/** A rule across the thread with a label in the middle, where something
 *  about the conversation changed (compaction, the model). */
export function ThreadRule({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span className="flex min-w-0 items-center gap-1.5">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
