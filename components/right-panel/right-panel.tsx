"use client";

import { Button } from "@/components/ui/button";
import { useAgents } from "@/lib/api/agents";
import { formatDuration } from "@/lib/dayjs";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { ChevronRightIcon, XIcon } from "lucide-react";

import {
  AgentStatusBadge,
  AgentView,
  agentDurationMs,
  deriveAgentStatus,
  findAgentMessage,
} from "./agent-view";
import { ArtifactView } from "./artifact-view";
import { ModelView } from "./model-view";
import { UsageView } from "./usage-view";

export function RightPanel({
  messages,
  contextWindow,
}: {
  messages: ChatMessage[];
  contextWindow: number;
}) {
  const sidepanel = useUiStore((s) => s.sidepanel);
  const close = useUiStore((s) => s.closeSidepanel);
  const { data: agentList = [] } = useAgents();

  if (!sidepanel) return null;

  // Breadcrumb root (the top-level pipeline) for the sub-agent panel.
  const agentMessage =
    sidepanel.kind === "agent"
      ? findAgentMessage(messages, sidepanel.messageId, sidepanel.agent)
      : undefined;
  const rootId = agentMessage?.metadata?.agentId;
  const rootName =
    agentList.find((a) => a.id === rootId)?.name ?? rootId ?? "Agent";
  const agentDuration =
    sidepanel.kind === "agent"
      ? agentDurationMs(agentMessage, sidepanel.agent)
      : undefined;

  return (
    <aside className="flex h-full flex-col border-l bg-card/30">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-5">
        {sidepanel.kind === "agent" ? (
          <nav className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm text-muted-foreground">
              {rootName}
            </span>
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span className="truncate text-sm font-semibold">
              {sidepanel.agent}
            </span>
            <AgentStatusBadge
              status={deriveAgentStatus(agentMessage, sidepanel.agent)}
              className="ml-1 shrink-0"
            />
            {agentDuration != null && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatDuration(agentDuration)}
              </span>
            )}
          </nav>
        ) : (
          <h2 className="truncate text-sm font-semibold">
            {sidepanel.kind === "usage" && "Context"}
            {sidepanel.kind === "artifact" && "Artifact"}
            {sidepanel.kind === "model" && "Model"}
          </h2>
        )}
        <Button variant="ghost" size="icon-sm" onClick={close}>
          <XIcon className="size-4" />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        {sidepanel.kind === "usage" && (
          <UsageView messages={messages} contextWindow={contextWindow} />
        )}
        {sidepanel.kind === "agent" && (
          <AgentView
            messages={messages}
            agent={sidepanel.agent}
            messageId={sidepanel.messageId}
          />
        )}
        {sidepanel.kind === "artifact" && (
          <ArtifactView messages={messages} artifactId={sidepanel.artifactId} />
        )}
        {sidepanel.kind === "model" && <ModelView modelId={sidepanel.modelId} />}
      </div>
    </aside>
  );
}
