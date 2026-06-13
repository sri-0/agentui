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

/** Collapse a message's agent-step / agent-stream parts into one card per agent. */
function collectAgents(message: ChatMessage): AgentState[] {
  const map = new Map<string, AgentState>();
  for (const part of message.parts) {
    if (part.type === "data-agent-step") {
      const d = part.data;
      const entry = map.get(d.agent) ?? {
        agent: d.agent,
        status: "started" as const,
        step: d.step,
        preview: "",
      };
      entry.status = d.status;
      entry.step = d.step;
      map.set(d.agent, entry);
    } else if (part.type === "data-agent-stream") {
      const d = part.data;
      const entry = map.get(d.agent) ?? {
        agent: d.agent,
        status: "started" as const,
        step: d.step,
        preview: "",
      };
      entry.preview = d.text;
      map.set(d.agent, entry);
    }
  }
  return [...map.values()];
}

export function AgentCards({ message }: { message: ChatMessage }) {
  const agents = collectAgents(message);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  if (agents.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
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
