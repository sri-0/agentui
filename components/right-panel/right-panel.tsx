"use client";

import { Button } from "@/components/ui/button";
import { useAgents } from "@/lib/api/agents";
import { useArtifactBody, useThreadArtifacts } from "@/lib/api/artifacts";
import { downloadArtifact } from "@/lib/chat/artifacts";
import { useChatStore } from "@/lib/chat/store";
import type { Artifact, ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { BotIcon, ChevronLeftIcon, DownloadIcon, ExternalLinkIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useEffect } from "react";

import { AgentDetailsView } from "./agent-details-view";
import { AgentStatusBadge, AgentView } from "./agent-view";
import { ArtifactBody, ArtifactList, EmbeddedPage } from "./artifact-view";
import { ConnectorDetailsView } from "./connector-details-view";
import { ModelView } from "./model-view";
import { SourcesView } from "./sources-view";
import { UsageView } from "./usage-view";

export function RightPanel({
  threadId,
  messages,
  artifacts,
  contextWindow,
}: {
  threadId: string;
  messages: ChatMessage[];
  /** the conversation's artifacts, newest first */
  artifacts: Artifact[];
  contextWindow: number;
}) {
  const sidepanel = useUiStore((s) => s.sidepanel);
  const close = useUiStore((s) => s.closeSidepanel);
  const { data: agentList = [] } = useAgents();
  const childStatus = useChatStore((s) =>
    sidepanel?.kind === "agent" ? s.threads[sidepanel.threadId]?.status : undefined,
  );

  const artifact = sidepanel?.kind === "artifact" ? artifacts.find((a) => a.id === sidepanel.artifactId) : undefined;
  // An artifact a sub-agent published reaches this thread only through the
  // API: the backend stores it before announcing it, so fetch the list again.
  const missingId = sidepanel?.kind === "artifact" && !artifact ? sidepanel.artifactId : undefined;
  const queryClient = useQueryClient();
  const { isFetching } = useThreadArtifacts(threadId);
  useEffect(() => {
    if (missingId) void queryClient.invalidateQueries({ queryKey: ["artifacts", threadId] });
  }, [missingId, threadId, queryClient]);

  if (!sidepanel) return null;

  return (
    <aside className="flex h-full flex-col border-l bg-card/30">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-5">
        {sidepanel.kind === "agent" ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <BotIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">{sidepanel.name}</span>
            {childStatus && <AgentStatusBadge status={childStatus} className="ml-1 shrink-0" />}
          </div>
        ) : sidepanel.kind === "agent-details" ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <BotIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">
              {agentList.find((a) => a.id === sidepanel.agentId)?.name ?? "Agent"}
            </span>
          </div>
        ) : sidepanel.kind === "artifact" ? (
          <ArtifactTitle title={artifact?.title ?? "Artifact"} />
        ) : (
          <h2 className="truncate text-sm font-semibold">
            {sidepanel.kind === "usage" && "Context"}
            {sidepanel.kind === "model" && "Model"}
            {sidepanel.kind === "connector" && "Connector"}
            {sidepanel.kind === "artifacts" && "Artifacts"}
            {sidepanel.kind === "sources" && "Sources"}
          </h2>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {artifact && <ArtifactActions threadId={threadId} artifact={artifact} />}
          <Button variant="ghost" size="icon-sm" title="Close" onClick={close}>
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>
      {sidepanel.kind === "agent" ? (
        <AgentView key={sidepanel.threadId} threadId={sidepanel.threadId} />
      ) : artifact?.kind === "url" ? (
        <div className="flex flex-1 flex-col">
          <EmbeddedPage artifact={artifact} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {sidepanel.kind === "usage" && <UsageView messages={messages} contextWindow={contextWindow} />}
          {sidepanel.kind === "artifacts" && <ArtifactList artifacts={artifacts} />}
          {sidepanel.kind === "artifact" &&
            (artifact ? (
              <ArtifactBody threadId={threadId} artifact={artifact} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {isFetching ? "Looking for the artifact…" : "Artifact not found."}
              </p>
            ))}
          {sidepanel.kind === "sources" && <SourcesView threadId={threadId} number={sidepanel.number} />}
          {sidepanel.kind === "model" && <ModelView modelId={sidepanel.modelId} />}
          {sidepanel.kind === "agent-details" && <AgentDetailsView agentId={sidepanel.agentId} />}
          {sidepanel.kind === "connector" && <ConnectorDetailsView connectorId={sidepanel.connectorId} />}
        </div>
      )}
    </aside>
  );
}

/** The open artifact's title, with the way back to the list. */
function ArtifactTitle({ title }: { title: string }) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button variant="ghost" size="icon-sm" title="All artifacts" onClick={() => openSidepanel({ kind: "artifacts" })}>
        <ChevronLeftIcon className="size-4" />
      </Button>
      <span className="truncate text-sm font-semibold">{title}</span>
    </div>
  );
}

/** Reload the artifact; open a page in a new tab, or download a body. */
function ArtifactActions({ threadId, artifact }: { threadId: string; artifact: Artifact }) {
  const refreshArtifact = useUiStore((s) => s.refreshArtifact);
  const queryClient = useQueryClient();
  const { body } = useArtifactBody(threadId, artifact);
  const reload = () => {
    if (artifact.kind === "url") refreshArtifact(artifact.id);
    else void queryClient.invalidateQueries({ queryKey: ["artifact-body", threadId, artifact.id] });
  };
  return (
    <>
      {artifact.content == null && (
        <Button variant="ghost" size="icon-sm" title="Refresh" onClick={reload}>
          <RotateCwIcon className="size-4" />
        </Button>
      )}
      {artifact.kind === "url" ? (
        <Button variant="ghost" size="icon-sm" title="Open in a new tab" asChild>
          <a href={artifact.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="size-4" />
          </a>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Download"
          disabled={body == null}
          onClick={() => body != null && downloadArtifact(artifact, body)}
        >
          <DownloadIcon className="size-4" />
        </Button>
      )}
    </>
  );
}
