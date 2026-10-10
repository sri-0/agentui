"use client";

import { Badge } from "@/components/ui/badge";
import type { AgentCard as AgentCardData } from "@/lib/chat/types";
import { formatDuration } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import {
  AlertCircleIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  LoaderIcon,
} from "lucide-react";
import { memo } from "react";

/**
 * A sub-agent dispatched by this turn: its status, progress line and log as
 * the backend reports them in the `agent` activity. Clicking opens the child's
 * own thread in the side panel. Memoized on the activity snapshot, which the
 * reducer replaces only when the backend sends a new one.
 */
export const AgentCard = memo(function AgentCard({
  data,
}: {
  data: AgentCardData;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const log = data.log ?? [];

  return (
    <div className="group flex w-full flex-col gap-2.5 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={() =>
          openSidepanel({
            kind: "agent",
            threadId: data.childThreadId,
            name: data.name,
          })
        }
        className="-m-1 flex items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-accent/30"
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            data.status === "error"
              ? "bg-destructive/10 text-destructive"
              : data.status === "running"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
          )}
        >
          <BotIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{data.name}</span>
          {data.description && (
            <span className="truncate text-[11px] text-muted-foreground">
              {data.description}
            </span>
          )}
        </span>
        <Badge
          variant="secondary"
          className="gap-1 rounded-full px-2 py-0.5 text-[10px] font-normal"
        >
          {data.status === "running" && (
            <>
              <LoaderIcon className="size-2.5 animate-spin" /> Working
            </>
          )}
          {data.status === "done" && (
            <>
              <CheckIcon className="size-2.5 text-emerald-500" /> Done
              {data.durationMs != null && (
                <span className="text-muted-foreground/70">
                  · {formatDuration(data.durationMs)}
                </span>
              )}
            </>
          )}
          {data.status === "error" && (
            <>
              <AlertCircleIcon className="size-2.5 text-destructive" /> Error
            </>
          )}
        </Badge>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>

      {(log.length > 0 || (data.status === "running" && data.progress)) && (
        <ul className="ml-1 space-y-1.5 border-l border-muted pl-3.5 text-xs">
          {log.map((entry, i) => (
            <li key={i} className="flex items-center gap-2 text-muted-foreground">
              <CheckIcon className="size-3 shrink-0 text-muted-foreground/60" />
              <span className="truncate">{entry.message}</span>
            </li>
          ))}
          {data.status === "running" && data.progress && (
            <li className="flex items-center gap-2">
              <LoaderIcon className="size-3 shrink-0 animate-spin text-primary" />
              <span className="truncate">{data.progress}</span>
            </li>
          )}
        </ul>
      )}
      {data.error && (
        <p className="break-words font-mono text-xs text-destructive">{data.error}</p>
      )}
      {data.text && (
        <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
          {data.text}
        </p>
      )}
    </div>
  );
});
