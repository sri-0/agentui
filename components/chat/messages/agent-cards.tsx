"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { BotIcon, CheckIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";

type AgentState = {
  agent: string;
  status: "started" | "done";
  step: number;
  preview: string;
};

/**
 * Cards for SUB-agents only — i.e. agents that stream their own output
 * separately (multi-agent workflows). The final/output agent streams into the
 * main thread, so it gets no card here.
 */
function collectAgents(message: ChatMessage, streaming: boolean): AgentState[] {
  // Reconstruct each sub-agent's text by concatenating its incremental deltas.
  const texts = new Map<string, string>();
  const stepNums = new Map<string, number>();
  const steps = new Map<string, "started" | "done">();

  for (const part of message.parts) {
    if (part.type === "data-agent-delta") {
      texts.set(part.data.agent, (texts.get(part.data.agent) ?? "") + part.data.delta);
      stepNums.set(part.data.agent, part.data.step);
    } else if (part.type === "data-agent-step") {
      steps.set(part.data.agent, part.data.status);
    }
  }

  const out: AgentState[] = [];
  for (const [agent, text] of texts) {
    // once the whole run has finished, no agent can still be "working"
    const status = streaming ? (steps.get(agent) ?? "started") : "done";
    out.push({ agent, status, step: stepNums.get(agent) ?? 0, preview: text });
  }
  return out;
}

export function AgentCards({
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
      {agents.map((a) => {
        const running = a.status !== "done";
        return (
          <button
            type="button"
            key={a.agent}
            onClick={() =>
              openSidepanel({
                kind: "agent",
                agent: a.agent,
                messageId: message.id,
              })
            }
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40",
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md",
                running
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <BotIcon className="size-4" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{a.agent}</span>
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-full px-1.5 py-0 text-[10px]"
                >
                  {running ? (
                    <>
                      <LoaderIcon className="size-2.5 animate-spin" /> Working
                    </>
                  ) : (
                    <>
                      <CheckIcon className="size-2.5 text-green-600" /> Done
                    </>
                  )}
                </Badge>
              </div>
              {a.preview && (
                <span className="truncate text-xs text-muted-foreground">
                  {a.preview.slice(-120)}
                </span>
              )}
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        );
      })}
    </div>
  );
}
