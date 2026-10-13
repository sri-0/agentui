"use client";

import type { Compaction } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronDownIcon, FoldVerticalIcon, LoaderIcon } from "lucide-react";
import { memo, useState } from "react";

import { Markdown } from "./markdown";
import { seconds } from "./tool-line";

/**
 * Where the backend compacted the conversation (the `compaction` activity): a
 * rule across the thread with the outcome, then the summary the model now
 * sees in place of the earlier turns, as a collapsible line styled like a
 * tool call. A declined compaction changed nothing and renders nothing.
 */
export const CompactionDivider = memo(function CompactionDivider({ data }: { data: Compaction }) {
  const [open, setOpen] = useState(false);
  if (data.status === "declined") return null;

  return (
    <div className="my-2 flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span className="flex min-w-0 items-center gap-1.5">
          {data.status === "running" && <LoaderIcon className="size-3.5 shrink-0 animate-spin" />}
          <span className="truncate" title={data.error}>
            {label(data)}
          </span>
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      {data.status === "completed" && data.summary && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-muted-foreground hover:bg-accent/50"
          >
            <FoldVerticalIcon className="size-3.5 shrink-0" />
            <span className="font-mono text-xs text-foreground">compact_context</span>
            <span className="min-w-0 flex-1 truncate text-xs">Summary of the earlier conversation</span>
            {data.durationMs != null && (
              <span className="shrink-0 font-mono text-[11px] tabular-nums">{seconds(data.durationMs)}</span>
            )}
            <CheckIcon className="size-3.5 shrink-0 text-emerald-500" />
            <ChevronDownIcon className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="ml-5 border-l pl-3 pt-1">
              <div className="max-h-80 overflow-auto rounded-md bg-muted/50 px-3 py-2 text-xs">
                <Markdown>{data.summary}</Markdown>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

function label(c: Compaction): string {
  switch (c.status) {
    case "running":
      return "Compacting context…";
    case "failed":
      return c.error ? `Compaction failed: ${c.error}` : "Compaction failed";
    default:
      return c.inputTokens && c.outputTokens
        ? `Context compacted · ${c.inputTokens.toLocaleString()} → ${c.outputTokens.toLocaleString()} tokens`
        : "Context compacted";
  }
}
