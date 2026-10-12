"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Source, useThreadSources } from "@/lib/api/sources";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { ExternalLinkIcon } from "lucide-react";
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

/** One source: what it is, where it came from, and the metadata the system
 *  attached to it, exactly as recorded. */
export function SourceDetails({ source: s }: { source: Source }) {
  const cites = s.cited_in?.length ?? 0;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="shrink-0 rounded px-1.5 tabular-nums">
          {s.number}
        </Badge>
        <div className="min-w-0 flex-1">
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
              <span className="break-words">{s.title || s.url}</span>
              <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
            </a>
          ) : (
            <span className="font-medium">{s.title || "Untitled"}</span>
          )}
          <p className="text-xs text-muted-foreground">
            {s.system} · {s.tool} · retrieved {dayjs(s.retrieved_at).fromNow()}
            {cites > 0 && ` · cited ${cites === 1 ? "once" : `${cites} times`}`}
          </p>
        </div>
      </div>
      {s.metadata && Object.keys(s.metadata).length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
          {Object.entries(s.metadata).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all font-mono">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
