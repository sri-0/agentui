"use client";

import { Agent, AgentContent } from "@/components/ai-elements/agent";
import { Badge } from "@/components/ui/badge";
import { useAgents } from "@/lib/api/agents";
import { useUiStore } from "@/stores/ui-store";
import { BotIcon, CheckIcon, ChevronRightIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

/** Full details for an agent definition, rendered with the AI Elements
 *  `Agent` component. Its sub-agents are agents too: clicking one opens its
 *  own details. */
export function AgentDetailsView({ agentId }: { agentId: string }) {
  const { data: agents = [] } = useAgents();
  const openSidepanel = useUiStore((s) => s.openSidepanel);

  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    return <p className="text-sm text-muted-foreground">Agent not found.</p>;
  }

  return (
    <Agent className="border-0">
      <AgentContent className="space-y-5 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-normal">
            {agent.kind}
          </Badge>
        </div>

        {agent.description && (
          <div className="space-y-2">
            <span className="font-medium text-muted-foreground text-sm">
              Description
            </span>
            <p className="text-sm leading-relaxed text-foreground/90">
              {agent.description}
            </p>
          </div>
        )}

        {agent.system_prompt && <SystemPrompt text={agent.system_prompt} />}

        {agent.tools && agent.tools.length > 0 && (
          <div className="space-y-2">
            <span className="font-medium text-muted-foreground text-sm">Tools</span>
            <ul className="flex flex-wrap gap-1.5">
              {agent.tools.map((name) => (
                <li key={name} className="rounded-md border bg-card px-2 py-1 font-mono text-xs">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {agent.subagents && agent.subagents.length > 0 && (
          <div className="space-y-3">
            <span className="font-medium text-muted-foreground text-sm">
              Sub-agents
            </span>
            <div className="flex flex-col gap-3">
              {agent.subagents.map((id) => {
                const sub = agents.find((a) => a.id === id);
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() =>
                      openSidepanel({ kind: "agent-details", agentId: id })
                    }
                    className="group flex w-full flex-col gap-2.5 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <BotIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm font-medium">
                        {sub?.name ?? id}
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    {sub?.description && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {sub.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </AgentContent>
    </Agent>
  );
}

/** The agent's system prompt, in a scrollable box with a copy button. */
function SystemPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-2">
      <span className="font-medium text-muted-foreground text-sm">
        Instructions
      </span>
      <div className="relative rounded-md bg-muted/50">
        <button
          type="button"
          onClick={copy}
          title={copied ? "Copied" : "Copy"}
          className="absolute right-2 top-2 z-10 rounded bg-muted/80 p-1 text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-emerald-500" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
        <p className="max-h-72 overflow-auto whitespace-pre-wrap p-3 pr-10 text-sm leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}
