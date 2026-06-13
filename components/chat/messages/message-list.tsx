"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import type { ChatStatus } from "ai";
import { FileTextIcon } from "lucide-react";

import { GradientOrb, ThinkingIndicator } from "../loading";
import { AgentCards } from "./agent-cards";
import { MessageActions } from "./message-actions";
import { ToolInterrupt } from "./tool-interrupt";

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

function MessageItem({
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

  // Latest transient progress line (if currently streaming)
  const progress = [...message.parts]
    .reverse()
    .find((p) => p.type === "data-agent-progress");

  return (
    <Message from={message.role}>
      <MessageContent>
        <AgentCards message={message} />

        {message.parts.map((part, i) => {
          switch (part.type) {
            case "text":
              return part.text ? (
                <MessageResponse key={i}>{part.text}</MessageResponse>
              ) : null;

            case "reasoning":
              return (
                <Reasoning
                  key={i}
                  isStreaming={streaming && i === message.parts.length - 1}
                  className="w-full"
                >
                  <ReasoningTrigger />
                  <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>
              );

            case "dynamic-tool":
              return (
                <Tool key={i}>
                  <ToolHeader
                    type="dynamic-tool"
                    state={part.state}
                    toolName={part.toolName}
                  />
                  <ToolContent>
                    {"input" in part && part.input != null && (
                      <ToolInput input={part.input} />
                    )}
                    {(("output" in part && part.output != null) ||
                      ("errorText" in part && part.errorText)) && (
                      <ToolOutput
                        output={"output" in part ? part.output : undefined}
                        errorText={
                          "errorText" in part ? part.errorText : undefined
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );

            case "data-tool-interrupt":
              return <ToolInterrupt key={i} data={part.data} />;

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

        {!isUser && streaming && progress?.type === "data-agent-progress" && (
          <div className="flex items-center gap-2.5">
            <GradientOrb />
            <Shimmer className="text-sm" duration={1.6}>
              {progress.data.message}
            </Shimmer>
          </div>
        )}

        {showActions && <MessageActions message={message} />}
      </MessageContent>
    </Message>
  );
}
