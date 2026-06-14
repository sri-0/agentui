"use client";

import {
  Agent,
  AgentContent,
  AgentTool,
  AgentTools,
} from "@/components/ai-elements/agent";
import { Badge } from "@/components/ui/badge";
import { useAgents } from "@/lib/api/agents";
import { useUiStore } from "@/stores/ui-store";
import type { Tool } from "ai";
import {
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  WrenchIcon,
} from "lucide-react";
import { useState } from "react";

/** Full details for an agent definition (or a sub-agent, when `subAgent` is set),
 *  rendered with the AI Elements `Agent` component. Sub-agents are clickable —
 *  navigation lives in the breadcrumb header (see RightPanel). */
export function AgentDetailsView({
  agentId,
  subAgent,
}: {
  agentId: string;
  subAgent?: string;
}) {
  const { data: agents = [] } = useAgents();
  const openSidepanel = useUiStore((s) => s.openSidepanel);

  const parent = agents.find((a) => a.id === agentId);
  if (!parent) {
    return <p className="text-sm text-muted-foreground">Agent not found.</p>;
  }

  const sub = subAgent
    ? parent.sub_agents?.find((s) => s.name === subAgent)
    : undefined;
  if (subAgent && !sub) {
    return <p className="text-sm text-muted-foreground">Sub-agent not found.</p>;
  }

  const entity = sub ?? parent;
  const isSub = Boolean(sub);

  return (
    <Agent className="border-0">
      <AgentContent className="space-y-5 pt-4">
        {(entity.provider || (!isSub && parent.model)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {entity.provider && (
              <Badge variant="secondary" className="font-normal">
                {entity.provider}
              </Badge>
            )}
            {!isSub && parent.model && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {parent.model}
              </Badge>
            )}
          </div>
        )}

        {entity.description && (
          <div className="space-y-2">
            <span className="font-medium text-muted-foreground text-sm">
              Description
            </span>
            <p className="text-sm leading-relaxed text-foreground/90">
              {entity.description}
            </p>
          </div>
        )}

        {entity.system_prompt && <SystemPrompt text={entity.system_prompt} />}

        {entity.tools && entity.tools.length > 0 && (
          <AgentTools type="single" collapsible>
            {entity.tools.map((name, i) => (
              <AgentTool
                key={name}
                value={`tool-${i}`}
                // Backend exposes tool names only; AgentTool reads description +
                // schema, so feed the name and an empty schema placeholder.
                tool={{ description: name, inputSchema: {} } as unknown as Tool}
              />
            ))}
          </AgentTools>
        )}

        {!isSub && parent.sub_agents && parent.sub_agents.length > 0 && (
          <div className="space-y-3">
            <span className="font-medium text-muted-foreground text-sm">
              Sub-agents
            </span>
            <div className="flex flex-col gap-3">
              {parent.sub_agents.map((s, i) => (
                <button
                  type="button"
                  key={s.id || s.name || i}
                  onClick={() =>
                    openSidepanel({
                      kind: "agent-details",
                      agentId,
                      subAgent: s.name,
                    })
                  }
                  className="group flex w-full flex-col gap-2.5 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                >
                  <div className="flex items-center gap-2.5">
                    <BotIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm font-medium">
                      {s.name}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  {s.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                  {s.tools && s.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {s.tools.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="gap-1 font-mono text-[10px] font-normal"
                        >
                          <WrenchIcon className="size-2.5" />
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))}
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
