"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgents } from "@/lib/api/agents";
import {
  collectArtifacts,
  downloadArtifact,
  findArtifact,
} from "@/lib/chat/artifacts";
import { formatDuration } from "@/lib/dayjs";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { ChevronRightIcon, DownloadIcon, XIcon } from "lucide-react";

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
        ) : sidepanel.kind === "artifact" ? (
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="shrink-0 text-sm font-semibold">Artifacts</h2>
            <ArtifactPicker messages={messages} value={sidepanel.artifactId} />
          </div>
        ) : (
          <h2 className="truncate text-sm font-semibold">
            {sidepanel.kind === "usage" && "Context"}
            {sidepanel.kind === "model" && "Model"}
          </h2>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {sidepanel.kind === "artifact" &&
            (() => {
              const artifact = findArtifact(messages, sidepanel.artifactId);
              return artifact ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Download"
                  onClick={() => downloadArtifact(artifact)}
                >
                  <DownloadIcon className="size-4" />
                </Button>
              ) : null;
            })()}
          <Button variant="ghost" size="icon-sm" onClick={close}>
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>
      {sidepanel.kind === "agent" ? (
        // Auto-follow the sub-agent's stream (and a scroll-to-bottom button),
        // identical to the main thread.
        <Conversation className="flex-1">
          <ConversationContent className="p-6">
            <AgentView
              messages={messages}
              agent={sidepanel.agent}
              messageId={sidepanel.messageId}
            />
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {sidepanel.kind === "usage" && (
            <UsageView messages={messages} contextWindow={contextWindow} />
          )}
          {sidepanel.kind === "artifact" && (
            <ArtifactView messages={messages} artifactId={sidepanel.artifactId} />
          )}
          {sidepanel.kind === "model" && (
            <ModelView modelId={sidepanel.modelId} />
          )}
        </div>
      )}
    </aside>
  );
}

/** Header dropdown to switch between the conversation's artifacts. */
function ArtifactPicker({
  messages,
  value,
}: {
  messages: ChatMessage[];
  value: string;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const artifacts = collectArtifacts(messages);

  if (artifacts.length <= 1) {
    return (
      <span className="truncate text-sm text-muted-foreground">
        {artifacts[0]?.title ?? "—"}
      </span>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(id) => openSidepanel({ kind: "artifact", artifactId: id })}
    >
      <SelectTrigger size="sm" className="max-w-[280px] font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="min-w-[240px]">
        {artifacts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <span className="truncate">{a.title}</span>
            <span className="ml-auto pl-3 text-xs text-muted-foreground">
              {a.kind}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
