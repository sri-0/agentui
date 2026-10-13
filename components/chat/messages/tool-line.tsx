"use client";

import { ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ToolPart } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

export type Approve = (interruptId: string, approved: boolean, justification?: string) => void;

/**
 * A tool call as one line: icon, name, a hint of its input, how long it took
 * and how it ended. Closed by default; opens to show the input and output.
 * An approval request opens it and shows the decision controls. Memoized on
 * the part, which the reducer only replaces on a real event for this call.
 */
export const ToolLine = memo(function ToolLine({ part, onApprove }: { part: ToolPart; onApprove: Approve }) {
  const pending = part.state === "approval";
  // Open while a decision is needed; the user's own toggle wins afterwards.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? pending;
  const [justification, setJustification] = useState("");
  const approvalRef = useRef<HTMLDivElement>(null);

  // A fresh approval can render below the fold; bring the buttons into view.
  useEffect(() => {
    if (!pending || !open) return;
    const id = requestAnimationFrame(() => approvalRef.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(id);
  }, [pending, open]);

  const decide = (approved: boolean) => {
    if (part.approval) onApprove(part.approval.id, approved, justification.trim() || undefined);
  };

  return (
    <div className="my-0.5 text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setToggled(!open)}
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-muted-foreground hover:bg-accent/50"
      >
        <WrenchIcon className="size-3.5 shrink-0" />
        <span className="font-mono text-xs text-foreground">{part.toolName}</span>
        <span className="min-w-0 flex-1 truncate text-xs">{hint(part.input)}</span>
        {part.durationMs != null && (
          <span className="shrink-0 font-mono text-[11px] tabular-nums">{seconds(part.durationMs)}</span>
        )}
        <StatusIcon part={part} />
        <ChevronDownIcon className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-5 flex flex-col gap-2 border-l pl-3 pt-1">
          {part.input != null && <ToolInput input={part.input} />}
          {pending && (
            <div ref={approvalRef} className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <ShieldAlertIcon className="size-3.5" />
                {part.prompt || "Review the parameters, then approve or deny."}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Justification (optional)"
                  className="h-8 min-w-40 flex-1 text-xs"
                />
                <Button size="sm" onClick={() => decide(true)}>
                  <CheckIcon className="size-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(false)}>
                  <XIcon className="size-4" /> Deny
                </Button>
              </div>
            </div>
          )}
          {!pending && part.approval?.reason && (
            <p className="text-xs text-muted-foreground">Justification: {part.approval.reason}</p>
          )}
          {part.state === "denied" && (
            <p className="text-xs text-muted-foreground">The call was denied and did not run.</p>
          )}
          {(part.output != null || part.errorText) && (
            <ToolOutput output={part.output} errorText={part.errorText} />
          )}
        </div>
      )}
    </div>
  );
});

function StatusIcon({ part }: { part: ToolPart }) {
  switch (part.state) {
    case "approval":
      return <ShieldAlertIcon className="size-3.5 shrink-0 text-amber-500" />;
    case "denied":
      return <ShieldXIcon className="size-3.5 shrink-0 text-destructive" />;
    case "error":
      return <XIcon className="size-3.5 shrink-0 text-destructive" />;
    case "running":
      return <LoaderIcon className="size-3.5 shrink-0 animate-spin text-primary" />;
    default:
      return part.approval?.approved ? (
        <ShieldCheckIcon className="size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <CheckIcon className="size-3.5 shrink-0 text-emerald-500" />
      );
  }
}

/** The first string argument, as a one-line hint of what the call is about. */
function hint(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  for (const v of Object.values(input as Record<string, unknown>)) {
    if (typeof v === "string" && v) return v.replace(/\s+/g, " ").slice(0, 120);
  }
  return "";
}

export function seconds(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
