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
import { deriveUsage } from "@/lib/chat/usage";
import { useUiStore } from "@/stores/ui-store";
import { GhostIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Composer } from "./composer/composer";
import { ConversationSkeleton } from "./loading";
import { MessageList } from "./messages/message-list";
import { TaskBar } from "./task-bar";
import { useAgentChat } from "./use-agent-chat";
import { useRequestBody } from "./use-request-body";

export function ThreadView({ threadId }: { threadId: string }) {
  const isTemporary = threadId.startsWith("temp-");
  const history = useThreadMessages(isTemporary ? null : threadId);

  // Wait for history before mounting the chat so initialMessages is correct.
  if (!isTemporary && history.isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="text-muted-foreground" />
        </header>
        <ConversationSkeleton />
      </div>
    );
  }

  const initial = isTemporary ? [] : fromHistory(history.data ?? []);
  return (
    <ThreadChat
      key={threadId}
      threadId={threadId}
      isTemporary={isTemporary}
      initialMessages={initial}
    />
  );
}

function ThreadChat({
  threadId,
  isTemporary,
  initialMessages,
}: {
  threadId: string;
  isTemporary: boolean;
  initialMessages: ChatMessage[];
}) {
  const { messages, sendMessage, status, stop } = useAgentChat({
    id: threadId,
    initialMessages,
  });
  const buildBody = useRequestBody(threadId, isTemporary);
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

  const onSubmit = (message: PromptInputMessage) => {
    if (!message.text.trim() && (message.files?.length ?? 0) === 0) return;
    sendMessage(
      { text: message.text, files: message.files },
      { body: buildBody({ hasFiles: (message.files?.length ?? 0) > 0 }) },
    );
  };

  const usage = deriveUsage(messages, contextWindow);

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex-1 overflow-hidden"
    >
      <ResizablePanel id="chat" minSize="40%">
        <div className="flex h-full flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <SidebarTrigger className="text-muted-foreground" />
            {isTemporary && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GhostIcon className="size-3.5" />
                Temporary chat
                <Badge
                  variant="secondary"
                  className="rounded-full px-2 py-0 text-[10px]"
                >
                  not saved
                </Badge>
              </span>
            )}
          </header>

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
                usage={{ used: usage.used, total: usage.total }}
                onOpenUsage={() => openSidepanel({ kind: "usage" })}
              />
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
