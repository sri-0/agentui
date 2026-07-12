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
import { isQuestionInterrupt, QuestionCard } from "./question-card";
import { RunProgress } from "./run-progress";
import { ToolCard } from "./tool-card";

type Part = ChatMessage["parts"][number];

/** Swarm orchestration tools whose raw generic tool cards are noise in the
 *  transcript — their state is surfaced by the TaskBar (`data-task-list`) and the
 *  sub-agent cards, so the raw cards are hidden. The TaskBar reads the separate
 *  `data-task-list` part, NOT these tool calls, so hiding them is safe. */
const HIDDEN_TOOL_CARDS = new Set(["task", "task_join", "todowrite"]);

export function MessageList({
  messages,
  status,
  stopped = false,
}: {
  messages: ChatMessage[];
  status: ChatStatus;
  /** The last turn was aborted by the user (Stop). Reflected as a "Stopped"
   *  run-progress badge instead of a false green "Completed". */
  stopped?: boolean;
}) {
  const last = messages[messages.length - 1];
  const waiting =
    status === "submitted" || (status === "streaming" && last?.role === "user");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;
        return (
          <MessageItem
            key={message.id}
            message={message}
            streaming={status === "streaming"}
            isLast={isLast}
            stopped={stopped && isLast}
          />
        );
      })}
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
  stopped = false,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  stopped?: boolean;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const isUser = message.role === "user";

  // Single pass over parts: classify the renderable ones, find text +
  // interrupts. Avoids several O(n) scans and — critically — never builds React
  // elements for the thousands of `data-agent-delta` parts (consumed by the
  // TaskBar / AgentView).
  let hasText = false;
  const interrupts = new Map<string, Part>();
  const renderable: { part: Part; i: number }[] = [];
  message.parts.forEach((part, i) => {
    switch (part.type) {
      case "text":
        if (part.text) hasText = true;
        renderable.push({ part, i });
        break;
      case "dynamic-tool":
        // The `question` tool renders exclusively as the interactive QuestionCard
        // (from its paired `data-tool-interrupt`). Skip its raw tool card so we
        // don't ALSO show a generic approve/deny card for the same interrupt.
        if (part.toolName === "question") break;
        // Swarm orchestration tools render via the TaskBar / sub-agent cards,
        // not as raw generic tool cards.
        if (HIDDEN_TOOL_CARDS.has(part.toolName)) break;
        renderable.push({ part, i });
        break;
      case "reasoning":
      case "data-artifact":
        renderable.push({ part, i });
        break;
      case "data-tool-interrupt":
        // Question interrupts render as their own interactive form (no paired
        // dynamic-tool part is required); approve/deny interrupts stay a
        // side-channel merged into the matching tool card.
        if (isQuestionInterrupt(part.data)) renderable.push({ part, i });
        else interrupts.set(part.data.toolCallId, part);
        break;
    }
  });
  const showActions = !isUser && hasText && !(streaming && isLast);

  return (
    <Message from={message.role}>
      <MessageContent
        className={isUser ? undefined : "w-full max-w-full min-w-0"}
      >
        {/* Top-level run progress ("Analyzing…") renders for ALL agents — for a
            swarm it's the activity indicator while the coordinator plans, before
            the task board appears. Sub-agent cards render for every multi-agent
            run (swarm included): they surface each child's LIVE streamed output
            inline (via Streamdown) so swarm workers are visible mid-run, not just
            through a manual side-panel click. */}
        {!isUser && (
          <>
            <RunProgress
              message={message}
              streaming={streaming}
              isLast={isLast}
              stopped={stopped}
            />
            <AgentCards message={message} streaming={streaming && isLast} />
          </>
        )}

        {renderable.map(({ part, i }, idx) => {
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
                  isStreaming={
                    streaming && isLast && idx === renderable.length - 1
                  }
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

            case "data-tool-interrupt":
              return <QuestionCard key={i} interrupt={part.data} />;

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
