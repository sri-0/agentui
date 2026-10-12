"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { RightPanel } from "@/components/right-panel/right-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useModels } from "@/lib/api/models";
import { useThreadSources } from "@/lib/api/sources";
import { fetchThread } from "@/lib/api/threads";
import { collectArtifacts, useArtifacts } from "@/lib/chat/artifacts";
import { useChatStore } from "@/lib/chat/store";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { useUiStore } from "@/stores/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenIcon, FileTextIcon, LoaderIcon } from "lucide-react";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";

import { Composer, type ComposerStatus } from "./composer/composer";
import { ThreadUsageRing } from "./composer/thread-usage-ring";
import { ConversationSkeleton } from "./loading";
import { MessageList } from "./messages/message-list";
import { TaskBar } from "./task-bar";
import { useThread } from "./use-thread";

export function ThreadView({ threadId }: { threadId: string }) {
  return (
    <ThreadIdContext value={threadId}>
      <ThreadChat key={threadId} threadId={threadId} />
    </ThreadIdContext>
  );
}

export function ThreadChat({ threadId }: { threadId: string }) {
  const { messages, status, loaded, error, send, approve, answer, stop } = useThread(threadId);
  const closeSidepanel = useUiStore((s) => s.closeSidepanel);
  const setConnectors = useUiStore((s) => s.setConnectors);

  // This view is keyed by thread: leaving it closes its side panel, and
  // opening it shows the connectors the thread remembers.
  useEffect(() => closeSidepanel, [closeSidepanel]);
  useEffect(() => {
    fetchThread(threadId).then((t) => setConnectors(t.connectors ?? null), () => {});
  }, [threadId, setConnectors]);
  const connected = useChatStore((s) => s.connected);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const sidepanel = useUiStore((s) => s.sidepanel);
  const panelOpen = Boolean(sidepanel);
  const sideDefault =
    sidepanel?.kind === "artifact" || sidepanel?.kind === "artifacts"
      ? 48
      : sidepanel?.kind === "agent"
        ? 42
        : 34;
  const { data: models = [] } = useModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const contextWindow =
    models.find((m) => m.id === selectedModel)?.context_length ?? 128_000;

  // Stable handlers keep the memoized Composer and header out of the
  // per-frame re-render path. See AGENTS.md "Thread & chat-stream performance".
  const onSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (message.text.trim()) send(message.text);
    },
    [send],
  );
  const onOpenUsage = useCallback(
    () => openSidepanel({ kind: "usage" }),
    [openSidepanel],
  );
  const contextSlot = useMemo(
    () => <ThreadUsageRing threadId={threadId} onOpenUsage={onOpenUsage} />,
    [threadId, onOpenUsage],
  );

  const live = useMemo(() => collectArtifacts(messages), [messages]);
  const artifacts = useArtifacts(threadId, live);
  const latestArtifactId = live.at(-1)?.id;
  const { data: sources = [] } = useThreadSources(threadId);
  const citedCount = sources.filter((s) => s.cited_in?.length).length;

  // A run that ends may have published artifacts and cited sources.
  const queryClient = useQueryClient();
  const streaming = status === "streaming";
  const wasStreaming = useRef(streaming);
  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      void queryClient.invalidateQueries({ queryKey: ["artifacts", threadId] });
      void queryClient.invalidateQueries({ queryKey: ["sources", threadId] });
    }
    wasStreaming.current = streaming;
  }, [streaming, threadId, queryClient]);

  // Auto-open the artifacts panel when a new artifact arrives during a run:
  // the latest id seen once history has loaded is the baseline, so reopening
  // a thread mid-run does not open it.
  const seenArtifactRef = useRef<string | null | undefined>(null);
  useEffect(() => {
    if (!loaded) return;
    if (seenArtifactRef.current === null) {
      seenArtifactRef.current = latestArtifactId;
      return;
    }
    if (seenArtifactRef.current === latestArtifactId) return;
    seenArtifactRef.current = latestArtifactId;
    if (streaming && latestArtifactId) {
      openSidepanel({ kind: "artifact", artifactId: latestArtifactId });
    }
  }, [loaded, latestArtifactId, streaming, openSidepanel]);

  if (!loaded) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="text-muted-foreground" />
        </header>
        <ConversationSkeleton />
      </div>
    );
  }

  // While the run waits for an answer or approval the composer shows the
  // stop button instead of accepting a second message.
  const composerStatus: ComposerStatus =
    streaming
      ? "streaming"
      : status === "awaiting_input"
        ? "submitted"
        : "ready";

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex-1 overflow-hidden"
    >
      <ResizablePanel id="chat" minSize="40%">
        <div className="flex h-full flex-col overflow-hidden">
          <ThreadHeader
            artifactCount={artifacts.length}
            sourceCount={citedCount}
            reconnecting={!connected}
          />

          <Conversation className="flex-1">
            <ConversationContent className="px-4 py-6">
              <MessageList
                messages={messages}
                status={status}
                approve={approve}
                answer={answer}
              />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="px-4 pb-5 pt-2">
            <TaskBar messages={messages} running={streaming} />
            <div className="mx-auto w-full max-w-3xl">
              {status === "error" && error && (
                <p className="mb-2 text-center text-xs text-destructive">{error}</p>
              )}
              <Composer
                onSubmit={onSubmit}
                status={composerStatus}
                onStop={stop}
                contextSlot={contextSlot}
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                AI can make mistakes. Always validate responses.
              </p>
            </div>
          </div>
        </div>
      </ResizablePanel>

      {panelOpen && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="side"
            defaultSize={`${sideDefault}%`}
            minSize="24%"
            maxSize="65%"
          >
            <RightPanel
              threadId={threadId}
              messages={messages}
              artifacts={artifacts}
              contextWindow={contextWindow}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

/** Static thread header — memoized so it never re-renders during streaming. */
const ThreadHeader = memo(function ThreadHeader({
  artifactCount,
  sourceCount,
  reconnecting,
}: {
  artifactCount: number;
  sourceCount: number;
  reconnecting: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="text-muted-foreground" />
      {reconnecting && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderIcon className="size-3.5 animate-spin" />
          Reconnecting…
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {sourceCount > 0 && (
          <PanelButton panel="sources" icon={<BookOpenIcon className="size-4" />} label="Sources" count={sourceCount} />
        )}
        {artifactCount > 0 && (
          <PanelButton panel="artifacts" icon={<FileTextIcon className="size-4" />} label="Artifacts" count={artifactCount} />
        )}
      </div>
    </header>
  );
});

/** A header button that toggles the conversation's artifacts or sources. */
function PanelButton({
  panel,
  icon,
  label,
  count,
}: {
  panel: "artifacts" | "sources";
  icon: ReactNode;
  label: string;
  count: number;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const closeSidepanel = useUiStore((s) => s.closeSidepanel);
  // A boolean selector: this button re-renders only when its panel toggles.
  const open = useUiStore((s) =>
    panel === "artifacts"
      ? s.sidepanel?.kind === "artifacts" || s.sidepanel?.kind === "artifact"
      : s.sidepanel?.kind === "sources",
  );
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground data-[active=true]:text-foreground"
      data-active={open}
      aria-pressed={open}
      onClick={() => (open ? closeSidepanel() : openSidepanel({ kind: panel }))}
    >
      {icon}
      {label}
      <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px] tabular-nums">
        {count}
      </Badge>
    </Button>
  );
}
