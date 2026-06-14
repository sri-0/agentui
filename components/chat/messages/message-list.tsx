"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import type { ChatStatus } from "ai";
import { FileTextIcon } from "lucide-react";
import { memo } from "react";

import { ThinkingIndicator } from "../loading";
import { AgentCards } from "./agent-cards";
import { MessageActions } from "./message-actions";
import { MessageMeta } from "./message-meta";
import { MessageReasoning } from "./message-reasoning";
import { RunProgress } from "./run-progress";
import { ToolCard } from "./tool-card";

export function MessageList({
  messages,
  status,
}: {
  messages: ChatMessage[];
  status: ChatStatus;
}) {
  const last = messages[messages.length - 1];
  const waiting =
    status === "submitted" || (status === "streaming" && last?.role === "user");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          streaming={status === "streaming"}
          isLast={index === messages.length - 1}
        />
      ))}
      {waiting && (
        <div className="flex">
          <ThinkingIndicator />
        </div>
      )}
    </div>
  );
}

// Memoized so a streaming token only re-renders the streaming (last) message —
// completed messages keep a stable object ref and skip the whole subtree
// (Streamdown, AgentCards/collectAgents, RunProgress).
const MessageItem = memo(function MessageItem({
  message,
  streaming,
  isLast,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const isUser = message.role === "user";
  const hasText = message.parts.some((p) => p.type === "text" && p.text);
  const showActions = !isUser && hasText && !(streaming && isLast);

  // HITL interrupts are merged into their tool card (matched by toolCallId),
  // not rendered as a separate card.
  const interrupts = new Map<string, ChatMessage["parts"][number]>();
  for (const p of message.parts) {
    if (p.type === "data-tool-interrupt") interrupts.set(p.data.toolCallId, p);
  }

  return (
    <Message from={message.role}>
      <MessageContent
        className={isUser ? undefined : "w-full max-w-full min-w-0"}
      >
        {!isUser && (
          <RunProgress message={message} streaming={streaming} isLast={isLast} />
        )}
        <AgentCards message={message} streaming={streaming && isLast} />

        {message.parts.map((part, i) => {
          switch (part.type) {
            case "text":
              return part.text ? (
                <MessageResponse key={i}>{part.text}</MessageResponse>
              ) : null;

            case "reasoning":
              return (
                <MessageReasoning
                  key={i}
                  text={part.text}
                  isStreaming={streaming && i === message.parts.length - 1}
                />
              );

            case "dynamic-tool": {
              const ip = interrupts.get(part.toolCallId);
              return (
                <ToolCard
                  key={i}
                  part={part}
                  interrupt={
                    ip?.type === "data-tool-interrupt" ? ip.data : undefined
                  }
                />
              );
            }

            // Interrupts render inside their tool card (see above), not separately.
            case "data-tool-interrupt":
              return null;

            case "data-artifact":
              return (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="my-1 w-fit gap-2"
                  onClick={() =>
                    openSidepanel({
                      kind: "artifact",
                      artifactId: part.data.id,
                    })
                  }
                >
                  <FileTextIcon className="size-4" />
                  {part.data.title}
                </Button>
              );

            default:
              return null;
          }
        })}

        {showActions && (
          <div className="mt-1.5 flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
            <MessageActions message={message} />
            <MessageMeta message={message} />
          </div>
        )}
      </MessageContent>
      {isUser && hasText && (
        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <MessageActions message={message} role="user" />
        </div>
      )}
    </Message>
  );
});
