"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { RightPanel } from "@/components/right-panel/right-panel";
import { Badge } from "@/components/ui/badge";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useModels } from "@/lib/api/models";
import { cancelSession } from "@/lib/api/sessions";
import { useThreadMessages } from "@/lib/api/threads";
import { collectArtifacts } from "@/lib/chat/artifacts";
import { fromHistory } from "@/lib/chat/from-history";
import { takePendingMessage } from "@/lib/chat/pending";
import type { ChatMessage } from "@/lib/chat/types";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, LoaderIcon, MessageCircleDashedIcon } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Composer } from "./composer/composer";
import { ThreadUsageRing } from "./composer/thread-usage-ring";
import { InterruptContext } from "./interrupt-context";
import { useInterruptResolver } from "./use-interrupt-resolver";
import { ConversationSkeleton } from "./loading";
import { MessageList } from "./messages/message-list";
import { TaskBar } from "./task-bar";
import { useAgentChat } from "./use-agent-chat";
import { useRequestBody } from "./use-request-body";
import { useSessionReconnect } from "./use-session-reconnect";

export function ThreadView({ threadId }: { threadId: string }) {
  // /chat/[threadId] is always a persisted thread — temporary chats run in-place
  // on /chat with no route (see LandingView).
  const history = useThreadMessages(threadId);

  // Wait for history before mounting the chat so initialMessages is correct.
  if (history.isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="text-muted-foreground" />
        </header>
        <ConversationSkeleton />
      </div>
    );
  }

  return (
    <ThreadChat
      key={threadId}
      threadId={threadId}
      isTemporary={false}
      initialMessages={fromHistory(history.data ?? [])}
    />
  );
}

export function ThreadChat({
  threadId,
  isTemporary,
  initialMessages,
}: {
  threadId: string;
  isTemporary: boolean;
  initialMessages: ChatMessage[];
}) {
  const { messages, sendMessage, setMessages, status, stop, chat } =
    useAgentChat({
      id: threadId,
      initialMessages,
    });
  const buildBody = useRequestBody(threadId, isTemporary);
  const queryClient = useQueryClient();

  // Whether the CURRENT (last) turn was stopped by the user. Aborting the AI-SDK
  // stream drops `status` back to "ready", which reads identically to a natural
  // finish — so without this flag the run-progress badge would flip to a false
  // green "Completed". Cleared whenever a new turn starts (send / resend).
  const [stopped, setStopped] = useState(false);

  // Stop = abort the client stream AND cancel the server-side run. The run
  // executes in the background decoupled from the connection, so `stop()` alone
  // leaves it executing and the session `running` forever. Persisted threads own
  // a server session keyed by their thread id (session_id === thread id);
  // temporary chats have no server session to cancel.
  const handleStop = useCallback(() => {
    stop();
    setStopped(true);
    if (!isTemporary) {
      void cancelSession(threadId).finally(() => {
        // Surface the `cancelled` status in the sidebar immediately rather than
        // waiting for useSessions' 5s refetchInterval.
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      });
    }
  }, [stop, isTemporary, threadId, queryClient]);

  // HITL: approve/deny a tool interrupt, then merge the backend continuation
  // (tool result + final answer) back into the conversation.
  const resolveInterrupt = useInterruptResolver(threadId, messages, setMessages);

  // Rejoin a still-running server-side session on load / after a drop. Persisted
  // threads only (temporary chats have no server-side session to rejoin).
  const { reconnecting } = useSessionReconnect(
    isTemporary ? "" : threadId,
    status,
    setMessages,
  );
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const sidepanel = useUiStore((s) => s.sidepanel);
  const panelOpen = Boolean(sidepanel);
  const sideDefault =
    sidepanel?.kind === "artifact" ? 48 : sidepanel?.kind === "agent" ? 42 : 34;
  const { data: models = [] } = useModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const contextWindow =
    models.find((m) => m.id === selectedModel)?.context_length ?? 128_000;

  // Kick off the pending first message handed over from the landing screen.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    const pending = takePendingMessage(threadId);
    if (pending) {
      startedRef.current = true;
      sendMessage(
        { text: pending.text, files: pending.files },
        { body: pending.body },
      );
    }
  }, [threadId, sendMessage]);

  // Stable handlers + a self-subscribing usage ring keep the memoized Composer
  // and header out of the per-token re-render path. See AGENTS.md
  // "Thread & chat-stream performance".
  const onSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (!message.text.trim() && (message.files?.length ?? 0) === 0) return;
      setStopped(false);
      sendMessage(
        { text: message.text, files: message.files },
        { body: buildBody({ hasFiles: (message.files?.length ?? 0) > 0 }) },
      );
    },
    [sendMessage, buildBody],
  );
  const onOpenUsage = useCallback(
    () => openSidepanel({ kind: "usage" }),
    [openSidepanel],
  );
  const contextSlot = useMemo(
    () => <ThreadUsageRing chat={chat} onOpenUsage={onOpenUsage} />,
    [chat, onOpenUsage],
  );

  const artifacts = collectArtifacts(messages);
  const latestArtifactId = artifacts.at(-1)?.id;

  // Auto-open the artifacts panel the moment a new artifact is generated during
  // a stream. Keyed only on latestArtifactId so it fires when a NEW artifact
  // appears — not on manual thread open (status idle) nor when a fresh turn
  // starts over an existing artifact (id unchanged). Streaming is read via a ref
  // so its changes don't trigger the effect.
  const streamingRef = useRef(false);
  streamingRef.current = status === "streaming" || status === "submitted";
  useEffect(() => {
    if (streamingRef.current && latestArtifactId) {
      openSidepanel({ kind: "artifact", artifactId: latestArtifactId });
    }
  }, [latestArtifactId, openSidepanel]);

  return (
    <InterruptContext.Provider value={resolveInterrupt}>
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
            reconnecting={reconnecting}
          />

          <Conversation className="flex-1">
            <ConversationContent className="px-4 py-6">
              <MessageList
                messages={messages}
                status={status}
                stopped={stopped}
              />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="px-4 pb-5 pt-2">
            <TaskBar
              messages={messages}
              running={status === "streaming" || status === "submitted"}
            />
            <div className="mx-auto w-full max-w-3xl">
              <Composer
                onSubmit={onSubmit}
                status={status}
                onStop={handleStop}
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
    </InterruptContext.Provider>
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
  reconnecting?: boolean;
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
            not saved
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
