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
import { useThreadMessages } from "@/lib/api/threads";
import { fromHistory } from "@/lib/chat/from-history";
import { takePendingMessage } from "@/lib/chat/pending";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { MessageCircleDashedIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { Composer } from "./composer/composer";
import { ThreadUsageRing } from "./composer/thread-usage-ring";
import { InterruptContext } from "./interrupt-context";
import { useInterruptResolver } from "./use-interrupt-resolver";
import { ConversationSkeleton } from "./loading";
import { MessageList } from "./messages/message-list";
import { TaskBar } from "./task-bar";
import { TemporaryToggle } from "./temporary-toggle";
import { useAgentChat } from "./use-agent-chat";
import { useRequestBody } from "./use-request-body";

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

  // HITL: approve/deny a tool interrupt, then merge the backend continuation
  // (tool result + final answer) back into the conversation.
  const resolveInterrupt = useInterruptResolver(threadId, messages, setMessages);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const sidepanel = useUiStore((s) => s.sidepanel);
  const panelOpen = Boolean(sidepanel);
  const sideDefault = sidepanel?.kind === "agent" ? 42 : 34;
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

  return (
    <InterruptContext.Provider value={resolveInterrupt}>
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex-1 overflow-hidden"
    >
      <ResizablePanel id="chat" minSize="40%">
        <div className="flex h-full flex-col overflow-hidden">
          <ThreadHeader isTemporary={isTemporary} />

          <Conversation className="flex-1">
            <ConversationContent className="px-4 py-6">
              <MessageList messages={messages} status={status} />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="px-4 pb-5 pt-2">
            <TaskBar messages={messages} />
            <div className="mx-auto w-full max-w-3xl">
              <Composer
                onSubmit={onSubmit}
                status={status}
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
    </InterruptContext.Provider>
  );
}

/** Static thread header — memoized so it never re-renders during streaming. */
const ThreadHeader = memo(function ThreadHeader({
  isTemporary,
}: {
  isTemporary: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="text-muted-foreground" />
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
      <div className="ml-auto">
        <TemporaryToggle />
      </div>
    </header>
  );
});
