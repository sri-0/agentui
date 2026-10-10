"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Task, TaskContent, TaskTrigger } from "@/components/ai-elements/task";
import { Button } from "@/components/ui/button";
import type { ThreadStatus } from "@/lib/chat/reduce";
import type { ChatMessage, ChatPart } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import {
  CheckIcon,
  ChevronDownIcon,
  FileIcon,
  FileTextIcon,
  LoaderIcon,
} from "lucide-react";
import { memo, type ReactNode } from "react";

import { ThinkingIndicator } from "../loading";
import { AgentCard } from "./agent-card";
import { MessageActions } from "./message-actions";
import { MessageMeta } from "./message-meta";
import { MessageReasoning } from "./message-reasoning";
import { QuestionCard, type Answer } from "./question-card";
import { ToolLine, type Approve } from "./tool-line";

export function MessageList({
  messages,
  status,
  approve,
  answer,
}: {
  messages: ChatMessage[];
  status: ThreadStatus;
  approve: Approve;
  answer: Answer;
}) {
  const last = messages.at(-1);
  const waiting =
    status === "streaming" &&
    (!last || last.role === "user" || !last.parts.some(isVisible));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          streaming={status === "streaming" && index === messages.length - 1}
          approve={approve}
          answer={answer}
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

const isVisible = (p: ChatPart) =>
  p.type !== "step-start" && !(p.type === "text" && !p.text);

const partKey = (p: ChatPart, i: number) =>
  p.type === "tool" ? p.toolCallId : ("id" in p && p.id) || i;

type Stage = { agent?: string; done: boolean; parts: ChatPart[] };

/** Group a message's parts into stages: consecutive steps (model calls) by
 *  the same agent are one stage, so a pipeline shows one card per agent. */
function groupStages(parts: ChatPart[]): Stage[] {
  const stages: Stage[] = [];
  for (const p of parts) {
    const last = stages.at(-1);
    if (p.type === "step-start") {
      if (last?.agent === p.agent) last.done = p.done;
      else stages.push({ agent: p.agent, done: p.done, parts: [] });
    } else if (!last) {
      stages.push({ done: true, parts: [p] });
    } else {
      last.parts.push(p);
    }
  }
  return stages;
}

// Memoized so a streaming frame only re-renders the message that changed:
// the reducer shares untouched messages, so settled ones keep their ref.
const MessageItem = memo(function MessageItem({
  message,
  streaming,
  approve,
  answer,
}: {
  message: ChatMessage;
  /** This is the last message and the thread is streaming. */
  streaming: boolean;
  approve: Approve;
  answer: Answer;
}) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const isUser = message.role === "user";
  const hasText = message.parts.some((p) => p.type === "text" && p.text);
  const showActions = !isUser && hasText && !streaming;

  // A pipeline runs other agents as stages before the output agent answers:
  // those stages collapse into cards and the last stage is the answer.
  const stages = groupStages(message.parts);
  const pipeline =
    stages.length > 1 &&
    stages.some((s) => s.agent && s.agent !== message.metadata?.agentId);

  const render = (part: ChatPart, i: number): ReactNode => {
    const key = partKey(part, i);
    switch (part.type) {
      case "text":
        return part.text ? (
          <MessageResponse key={key}>{part.text}</MessageResponse>
        ) : null;
      case "reasoning":
        return (
          <MessageReasoning
            key={key}
            text={part.text}
            isStreaming={!part.done}
            duration={
              part.durationMs != null
                ? Math.max(1, Math.ceil(part.durationMs / 1000))
                : undefined
            }
          />
        );
      case "tool":
        // A sub-agent's question, forwarded through its task call, is asked here.
        if (part.state === "approval" && part.request?.toolName === "question") {
          return (
            <QuestionCard
              key={key}
              part={{ ...part, toolName: "question", input: part.request.args }}
              pending
              onAnswer={answer}
            />
          );
        }
        // The card mounts once the questions (the call's input) have arrived.
        return part.toolName === "question" && part.input != null ? (
          <QuestionCard
            key={key}
            part={part}
            pending={part.state === "approval"}
            onAnswer={answer}
          />
        ) : (
          <ToolLine key={key} part={part} onApprove={approve} />
        );
      case "data-agent":
        return <AgentCard key={key} data={part.data} />;
      case "data-artifact":
        return (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="my-1 w-fit gap-2"
            onClick={() =>
              openSidepanel({ kind: "artifact", artifactId: part.data.id })
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
  };

  return (
    <Message from={message.role}>
      <MessageContent
        className={isUser ? undefined : "w-full max-w-full min-w-0"}
      >
        {pipeline
          ? stages.map((stage, si) =>
              si === stages.length - 1 ? (
                stage.parts.map(render)
              ) : (
                <StageCard key={si} agent={stage.agent ?? "stage"} done={stage.done}>
                  {stage.parts.map(render)}
                </StageCard>
              ),
            )
          : message.parts.map(render)}

        {message.metadata?.cancelled && (
          <p className="text-xs text-muted-foreground">Stopped.</p>
        )}
        {message.metadata?.error && (
          <p className="text-xs text-destructive">{message.metadata.error}</p>
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

/** A collapsible card for one stage of a pipeline. */
function StageCard({
  agent,
  done,
  children,
}: {
  agent: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <Task defaultOpen={!done} className="my-1 rounded-xl border bg-card px-3 py-2">
      <TaskTrigger title={agent}>
        <div className="flex w-full cursor-pointer items-center gap-2 text-sm">
          {done ? (
            <CheckIcon className="size-4 text-muted-foreground" />
          ) : (
            <LoaderIcon className="size-4 animate-spin text-primary" />
          )}
          <span className="font-medium">{agent}</span>
          <ChevronDownIcon className="ml-auto size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </TaskTrigger>
      <TaskContent className="flex flex-col gap-3 pt-2">{children}</TaskContent>
    </Task>
  );
}
