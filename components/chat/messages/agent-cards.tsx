"use client";

import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import {
  AlertCircleIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  LoaderIcon,
} from "lucide-react";
import { memo } from "react";

/** Signature of sub-agent state shown on the cards: which agents exist, their
 *  lifecycle/duration, and progress steps — but NOT per-token deltas (the card
 *  shows steps/status, not streamed text), so tokens don't re-render the cards. */
function agentCardsKey(message: ChatMessage): string {
  const seen = new Set<string>();
  let lifecycle = "";
  let prog = "";
  for (const p of message.parts) {
    if (p.type === "data-agent-delta") seen.add(p.data.agent);
    else if (p.type === "data-agent-step")
      lifecycle += `${p.data.agent}:${p.data.status}:${p.data.durationMs ?? ""};`;
    else if (p.type === "data-agent-progress" && p.data.agent)
      prog += `${p.data.message};`;
  }
  return `${[...seen].sort().join(",")}|${lifecycle}|${prog}`;
}

type Step = {
  label: string;
  state: "active" | "done" | "error";
  count: number;
};

type AgentState = {
  agent: string;
  status: "working" | "done" | "error";
  steps: Step[];
  durationMs?: number;
};

/** Swarm children are keyed `"<type>#<id>"` (W3): the base type identifies the
 *  KIND, the id disambiguates multiple instances of that kind. Show the type as
 *  the primary label and a short instance suffix so N children of one type are
 *  visually distinct cards (they already ARE distinct — keyed by the full
 *  `type#id` string — this only makes the label readable). */
function agentLabel(agent: string): { name: string; instance?: string } {
  const hash = agent.indexOf("#");
  if (hash === -1) return { name: agent };
  const type = agent.slice(0, hash);
  const id = agent.slice(hash + 1);
  return { name: type, instance: id.length > 8 ? id.slice(0, 8) : id };
}

/**
 * Cards for SUB-agents (agents that stream their own output — multi-agent runs).
 * The card shows whatever PROGRESS the backend emits for that agent (tool runs,
 * errors, …) as a step log, deduped like the top-level agent. Its full output
 * (reasoning + answer) opens in the side panel on click. The final/output agent
 * streams into the main thread (no card).
 */
function collectAgents(message: ChatMessage, streaming: boolean): AgentState[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const lifecycle = new Map<string, "started" | "done">();
  const durations = new Map<string, number>();
  const progress = new Map<string, { message: string; phase: string }[]>();

  const touch = (a: string) => {
    if (!seen.has(a)) {
      seen.add(a);
      order.push(a);
    }
  };

  for (const part of message.parts) {
    // Only agents that stream their OWN output (data-agent-delta) get a card —
    // the top-level/output agent's answer is in the main thread and its progress
    // shows in RunProgress, so it must not be carded (avoids the double-up).
    if (part.type === "data-agent-delta") {
      touch(part.data.agent);
    } else if (part.type === "data-agent-step") {
      lifecycle.set(part.data.agent, part.data.status);
      if (part.data.durationMs != null)
        durations.set(part.data.agent, part.data.durationMs);
    } else if (part.type === "data-agent-progress" && part.data.agent) {
      const list = progress.get(part.data.agent) ?? [];
      list.push({ message: part.data.message, phase: part.data.phase });
      progress.set(part.data.agent, list);
    }
  }

  return order.map((agent) => {
    const errored = (progress.get(agent) ?? []).some((s) => s.phase === "error");
    const done = !streaming || lifecycle.get(agent) === "done";
    const status: AgentState["status"] = errored
      ? "error"
      : done
        ? "done"
        : "working";

    // Backend progress only, consecutive duplicates collapsed into ×count.
    const steps: Step[] = [];
    for (const p of progress.get(agent) ?? []) {
      const last = steps[steps.length - 1];
      if (last && last.label === p.message) {
        last.count++;
        continue;
      }
      steps.push({
        label: p.message,
        state: p.phase === "error" ? "error" : "done",
        count: 1,
      });
    }
    // While still working, the latest non-error step is the current one.
    const tail = steps[steps.length - 1];
    if (!done && tail && tail.state !== "error") tail.state = "active";

    return { agent, status, steps, durationMs: durations.get(agent) };
  });
}

export const AgentCards = memo(function AgentCards({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const agents = collectAgents(message, streaming);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  if (agents.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      {agents.map((a) => (
        <div
          key={a.agent}
          className="group flex w-full flex-col gap-2.5 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40"
        >
          <button
            type="button"
            onClick={() =>
              openSidepanel({
                kind: "agent",
                agent: a.agent,
                messageId: message.id,
              })
            }
            className="-m-1 flex items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-accent/30"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg",
                a.status === "error"
                  ? "bg-destructive/10 text-destructive"
                  : a.status === "working"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <BotIcon className="size-4" />
            </span>
            <span className="flex-1 truncate text-sm font-medium">
              {(() => {
                const { name, instance } = agentLabel(a.agent);
                return (
                  <>
                    {name}
                    {instance && (
                      <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                        #{instance}
                      </span>
                    )}
                  </>
                );
              })()}
            </span>
            <Badge
              variant="secondary"
              className="gap-1 rounded-full px-2 py-0.5 text-[10px] font-normal"
            >
              {a.status === "working" && (
                <>
                  <LoaderIcon className="size-2.5 animate-spin" /> Working
                </>
              )}
              {a.status === "done" && (
                <>
                  <CheckIcon className="size-2.5 text-emerald-500" /> Done
                  {a.durationMs != null && (
                    <span className="text-muted-foreground/70">
                      · {formatDuration(a.durationMs)}
                    </span>
                  )}
                </>
              )}
              {a.status === "error" && (
                <>
                  <AlertCircleIcon className="size-2.5 text-destructive" /> Error
                </>
              )}
            </Badge>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          {a.steps.length > 0 && (
            <ul className="ml-1 space-y-1.5 border-l border-muted pl-3.5 text-xs">
              {a.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  {s.state === "active" && (
                    <LoaderIcon className="size-3 shrink-0 animate-spin text-primary" />
                  )}
                  {s.state === "done" && (
                    <CheckIcon className="size-3 shrink-0 text-muted-foreground/60" />
                  )}
                  {s.state === "error" && (
                    <AlertCircleIcon className="size-3 shrink-0 text-destructive" />
                  )}
                  <span
                    className={cn(
                      "truncate",
                      s.state === "error"
                        ? "text-destructive"
                        : s.state === "active"
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                  {s.count > 1 && (
                    <span className="shrink-0 text-muted-foreground/60">
                      ×{s.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
});
