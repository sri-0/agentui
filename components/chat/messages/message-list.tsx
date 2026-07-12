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
import { FileIcon, FileTextIcon, HelpCircleIcon } from "lucide-react";
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
  activeQuestionId,
}: {
  messages: ChatMessage[];
  status: ChatStatus;
  /** The last turn was aborted by the user (Stop). Reflected as a "Stopped"
   *  run-progress badge instead of a false green "Completed". */
  stopped?: boolean;
  /** toolCallId of the question interrupt currently shown in the composer slot.
   *  That one is NOT rendered inline here (it lives in the footer) to avoid a
   *  double render. */
  activeQuestionId?: string;
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
            activeQuestionId={activeQuestionId}
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
  activeQuestionId,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  stopped?: boolean;
  /** The question currently shown in the composer slot — not rendered inline. */
  activeQuestionId?: string;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const skippedQuestions = useUiStore((s) => s.skippedQuestions);
  const unskipQuestion = useUiStore((s) => s.unskipQuestion);
  const isUser = message.role === "user";

  // Single pass over parts: classify the renderable ones, find text +
  // interrupts. Avoids several O(n) scans and — critically — never builds React
  // elements for the thousands of `data-agent-delta` parts (consumed by the
  // TaskBar / AgentView).
  let hasText = false;
  const interrupts = new Map<string, Part>();
  const renderable: { part: Part; i: number }[] = [];
  // toolCallIds of question interrupts on THIS message the user has skipped but
  // not yet answered — surfaced as a "Skipped Questions" reopen button.
  const skippedIds: string[] = [];
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
        if (isQuestionInterrupt(part.data)) {
          const id = part.data.toolCallId;
          // SETTLED (answered) questions render inline as transcript history.
          // An UNRESOLVED question is either shown in the composer slot (active)
          // or, if skipped, represented by the "Skipped Questions" button below
          // — so it is NOT rendered inline here (avoids a double render).
          if (part.data.resolved) {
            renderable.push({ part, i });
          } else if (id === activeQuestionId) {
            // shown in the composer slot; skip inline
          } else if (skippedQuestions.has(id)) {
            skippedIds.push(id);
          } else {
            // unresolved, not-yet-active (e.g. reconnect edge) — render inline
            renderable.push({ part, i });
          }
        } else {
          interrupts.set(part.data.toolCallId, part);
        }
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

            case "reasoning": {
              const isReasoningStreaming =
                streaming && isLast && idx === renderable.length - 1;
              // Persisted timing (unix-ms of first/last reasoning delta) →
              // duration in seconds, so a reloaded collapse shows the real
              // "Thought for N seconds". While still streaming live we leave it
              // undefined so <Reasoning> uses its own client-side timer.
              const timing = part as { startedMs?: number; endedMs?: number };
              const reasoningDuration =
                !isReasoningStreaming &&
                typeof timing.startedMs === "number" &&
                typeof timing.endedMs === "number" &&
                timing.endedMs >= timing.startedMs
                  ? Math.max(
                      1,
                      Math.ceil((timing.endedMs - timing.startedMs) / 1000)
                    )
                  : undefined;
              return (
                <MessageReasoning
                  key={i}
                  text={part.text}
                  isStreaming={isReasoningStreaming}
                  duration={reasoningDuration}
                />
              );
            }

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
                  {part.data.kind === "file" ? (
                    <FileIcon className="size-4" />
                  ) : (
                    <FileTextIcon className="size-4" />
                  )}
                  {part.data.title}
                </Button>
              );

            default:
              return null;
          }
        })}

        {/* A question the user skipped (Dismiss) but hasn't answered — the run
            is still awaiting-input. Reopen it into the composer slot to answer. */}
        {skippedIds.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="my-1 w-fit gap-2"
            onClick={() => skippedIds.forEach((id) => unskipQuestion(id))}
          >
            <HelpCircleIcon className="size-4 text-primary" />
            Skipped Questions
          </Button>
        )}

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
