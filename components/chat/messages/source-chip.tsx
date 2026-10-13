"use client";

import { SourceDetails, SourceSystem } from "@/components/chat/source-details";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSource, useThreadSources } from "@/lib/api/sources";
import { useThreadId } from "@/lib/chat/thread-context";
import { useUiStore } from "@/stores/ui-store";
import { useState } from "react";

/** A [source:N] citation: the system it came from and the number, which
 *  opens what the backend recorded for it. The conversation's sources are
 *  listed once for every chip; one the list does not have yet (it is
 *  refetched when a run ends) shows its number and is fetched on open. */
export function SourceChip({ number }: { number: number }) {
  const threadId = useThreadId();
  const [open, setOpen] = useState(false);
  const listed = useThreadSources(threadId).data?.find((s) => s.number === number);
  const fetched = useSource(threadId, number, open && !listed);
  const data = listed ?? fetched.data;
  const error = listed ? null : fetched.error;
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-source={number}
          aria-label={`Source ${number}`}
          className="mx-0.5 inline-flex h-4 min-w-4 max-w-40 -translate-y-px items-center justify-center gap-1 rounded bg-muted px-1 align-middle text-[10px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
        >
          {listed && <SourceSystem system={listed.system} iconClassName="size-2.5 shrink-0" />}
          <span>{number}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : data ? (
          <SourceDetails source={data} />
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        <Button
          variant="link"
          size="sm"
          className="mt-2 h-auto p-0 text-xs"
          onClick={() => {
            setOpen(false);
            openSidepanel({ kind: "sources", number });
          }}
        >
          All sources
        </Button>
      </PopoverContent>
    </Popover>
  );
}
