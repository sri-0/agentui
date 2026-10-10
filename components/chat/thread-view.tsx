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
import { collectArtifacts } from "@/lib/chat/artifacts";
import { useChatStore } from "@/lib/chat/store";
import { useUiStore } from "@/stores/ui-store";
import { FileTextIcon, LoaderIcon, MessageCircleDashedIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { Composer, type ComposerStatus } from "./composer/composer";
import { ThreadUsageRing } from "./composer/thread-usage-ring";
import { ConversationSkeleton } from "./loading";
import { MessageList } from "./messages/message-list";
import { TaskBar } from "./task-bar";
import { useThread } from "./use-thread";

export function ThreadView({ threadId }: { threadId: string }) {
  return <ThreadChat key={threadId} threadId={threadId} isTemporary={false} />;
}

export function ThreadChat({
  threadId,
  isTemporary,
}: {
  threadId: string;
  isTemporary: boolean;
}) {
  const { messages, status, interrupts, loaded, error, send, approve, answer, stop } =
    useThread(threadId);
  const connected = useChatStore((s) => s.connected);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const sidepanel = useUiStore((s) => s.sidepanel);
  const panelOpen = Boolean(sidepanel);
  const sideDefault =
    sidepanel?.kind === "artifact" ? 48 : sidepanel?.kind === "agent" ? 42 : 34;
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

  const artifacts = useMemo(() => collectArtifacts(messages), [messages]);
  const latestArtifactId = artifacts.at(-1)?.id;

  // Auto-open the artifacts panel the moment a new artifact is generated
  // during a run: only when latestArtifactId changes, not on thread open and
  // not when the status alone changes.
  const seenArtifactRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seenArtifactRef.current === latestArtifactId) return;
    seenArtifactRef.current = latestArtifactId;
    if (status === "streaming" && latestArtifactId) {
      openSidepanel({ kind: "artifact", artifactId: latestArtifactId });
    }
  }, [latestArtifactId, status, openSidepanel]);

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
    status === "streaming"
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
            isTemporary={isTemporary}
            artifactCount={artifacts.length}
            latestArtifactId={latestArtifactId}
            reconnecting={!connected}
          />

          <Conversation className="flex-1">
            <ConversationContent className="px-4 py-6">
              <MessageList
                messages={messages}
                status={status}
                interrupts={interrupts}
                approve={approve}
                answer={answer}
              />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="px-4 pb-5 pt-2">
            <TaskBar messages={messages} running={status === "streaming"} />
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
            <RightPanel messages={messages} contextWindow={contextWindow} />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

/** Static thread header — memoized so it never re-renders during streaming. */
const ThreadHeader = memo(function ThreadHeader({
  isTemporary,
  artifactCount,
  latestArtifactId,
  reconnecting,
}: {
  isTemporary: boolean;
  artifactCount: number;
  latestArtifactId?: string;
  reconnecting: boolean;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const closeSidepanel = useUiStore((s) => s.closeSidepanel);
  // Selector returns a boolean → header only re-renders when the panel toggles
  // open/closed for artifacts, not on every sidepanel change.
  const artifactOpen = useUiStore((s) => s.sidepanel?.kind === "artifact");
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="text-muted-foreground" />
      {reconnecting && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderIcon className="size-3.5 animate-spin" />
          Reconnecting…
        </span>
      )}
      {isTemporary && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageCircleDashedIcon className="size-3.5" />
          Temporary chat
          <Badge
            variant="secondary"
            className="rounded-full px-2 py-0 text-[10px]"
          >
            persisted
          </Badge>
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {artifactCount > 0 && latestArtifactId && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground data-[active=true]:text-foreground"
            data-active={artifactOpen}
            onClick={() =>
              artifactOpen
                ? closeSidepanel()
                : openSidepanel({
                    kind: "artifact",
                    artifactId: latestArtifactId,
                  })
            }
          >
            <FileTextIcon className="size-4" />
            Artifacts
            <Badge
              variant="secondary"
              className="rounded-full px-1.5 py-0 text-[10px] tabular-nums"
            >
              {artifactCount}
            </Badge>
          </Button>
        )}
      </div>
    </header>
  );
});
