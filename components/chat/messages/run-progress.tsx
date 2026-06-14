"use client";

import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task";
import { Badge } from "@/components/ui/badge";
import { useAgents } from "@/lib/api/agents";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { BotIcon, Check, ChevronDownIcon } from "lucide-react";
import { memo } from "react";

/** Signature of the run-level (orchestrator) progress — changes only when a new
 *  progress phase arrives, not on output tokens. */
function runProgressKey(message: ChatMessage): string {
  let k = "";
  for (const p of message.parts) {
    if (p.type === "data-agent-progress" && !p.data.agent) k += `${p.data.message}|`;
  }
  return k;
}

/** A small pulsing circle (expanding ring + solid dot), used instead of a spinner. */
function PulseDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-2.5 shrink-0 items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500/50" />
      <span className="relative inline-flex size-1.5 rounded-full bg-blue-500" />
    </span>
  );
}

/**
 * Inline progress for the TOP-LEVEL / output agent (the one whose answer is in
 * the main thread). Sub-agents get clickable cards instead — see AgentCards.
 * Renders the backend's agent_progress phases as a collapsible step log.
 */
export const RunProgress = memo(function RunProgress({
  message,
  streaming,
  isLast,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
}) {
  const { data: agents = [] } = useAgents();

  // Top-level orchestrator progress only — per-agent steps (which carry an
  // `agent`) render inside that sub-agent's card instead.
  const rawSteps = message.parts
    .filter((p) => p.type === "data-agent-progress" && !p.data.agent)
    .map((p) => (p.type === "data-agent-progress" ? p.data.message : ""))
    .filter(Boolean);

  if (rawSteps.length === 0) return null;

  // Collapse consecutive identical steps into one with a count (opencode-style).
  const steps: { message: string; count: number }[] = [];
  for (const m of rawSteps) {
    const last = steps[steps.length - 1];
    if (last && last.message === m) last.count++;
    else steps.push({ message: m, count: 1 });
  }
  const totalSteps = rawSteps.length;

  const working = streaming && isLast;
  const agentId = message.metadata?.agentId;
  const agentName =
    agents.find((a) => a.id === agentId)?.name ?? agentId ?? "Agent";

  return (
    <Task defaultOpen={working} className="not-prose mb-1 w-full">
      <TaskTrigger title="">
        <div className="flex w-full cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <BotIcon className="size-4 shrink-0" />
          <span className="font-medium text-foreground">{agentName}</span>
          <Badge
            variant="secondary"
            className="gap-1.5 rounded-full px-2 py-0.5 font-normal text-[11px]"
          >
            {working ? (
              <>
                <PulseDot /> Running · {totalSteps} steps
              </>
            ) : (
              <>
                <Check className="text-green-500" /> Completed · {totalSteps}{" "}
                step{totalSteps === 1 ? "" : "s"}
              </>
            )}
          </Badge>
          <ChevronDownIcon className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </TaskTrigger>
      <TaskContent>
        {steps.map((s, i) => {
          const isCurrent = working && i === steps.length - 1;
          return (
            <TaskItem key={i} className="flex items-center gap-2">
              {isCurrent ? (
                <PulseDot />
              ) : (
                <span className="flex size-2.5 shrink-0 items-center justify-center">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                </span>
              )}
              <span className={isCurrent ? "text-foreground" : undefined}>
                {s.message}
              </span>
              {s.count > 1 && (
                <span className="text-xs text-muted-foreground/60">
                  ×{s.count}
                </span>
              )}
            </TaskItem>
          );
        })}
      </TaskContent>
    </Task>
  );
},
(a, b) =>
  a.streaming === b.streaming &&
  a.isLast === b.isLast &&
  runProgressKey(a.message) === runProgressKey(b.message));
