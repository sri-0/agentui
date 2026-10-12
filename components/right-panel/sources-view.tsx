"use client";

import { SourceDetails } from "@/components/chat/source-details";
import { Button } from "@/components/ui/button";
import { useThreadSources } from "@/lib/api/sources";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

/**
 * The conversation's sources: what tools returned, numbered as answers cite
 * them. Cited ones are listed; the rest of what tools returned is one click
 * away. `number` picks one out (from a citation's popover).
 */
export function SourcesView({ threadId, number }: { threadId: string; number?: number }) {
  const { data: sources = [], isPending, error } = useThreadSources(threadId);
  const [showAll, setShowAll] = useState(false);
  const picked = useRef<HTMLLIElement>(null);
  useEffect(() => {
    picked.current?.scrollIntoView({ block: "center" });
  }, [number, sources.length]);

  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (isPending) return <p className="text-sm text-muted-foreground">Loading sources…</p>;
  const cited = sources.filter((s) => s.cited_in?.length);
  // The picked source is shown even when nothing cites it yet.
  const shown = showAll ? sources : sources.filter((s) => s.cited_in?.length || s.number === number);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {cited.length} cited · {sources.length} retrieved
        </span>
        {sources.length > cited.length && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show cited only" : "Show all retrieved"}
          </Button>
        )}
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No sources cited yet.</p>}
      <ul className="flex flex-col gap-3">
        {shown.map((s) => (
          <li
            key={s.number}
            ref={s.number === number ? picked : undefined}
            className={cn("rounded-lg border p-3", s.number === number && "border-primary/60 bg-primary/5")}
          >
            <SourceDetails source={s} />
          </li>
        ))}
      </ul>
    </div>
  );
}
