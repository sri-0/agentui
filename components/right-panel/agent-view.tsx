"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { AlertCircleIcon, CheckIcon, LoaderIcon } from "lucide-react";

export type AgentStatus = "working" | "done" | "error";

/** Resolve the message carrying a sub-agent's parts. The side-panel state lives
 *  in a global store, so its messageId can outlive the message in the live array
 *  (after a remount/navigation); fall back to the most recent message that has
 *  parts for this agent so the panel never silently renders empty. */
export function findAgentMessage(
  messages: ChatMessage[],
  messageId: string,
  agent: string,
): ChatMessage | undefined {
  const byId = messages.find((m) => m.id === messageId);
  if (byId) return byId;
  for (let i = messages.length - 1; i >= 0; i--) {
    const hit = messages[i].parts.some(
      (p) =>
        (p.type === "data-agent-delta" ||
          p.type === "data-agent-step" ||
          p.type === "data-agent-progress") &&
        p.data.agent === agent,
    );
    if (hit) return messages[i];
  }
  return undefined;
}

/** The recorded run time of a sub-agent, if its `done` step has arrived. */
export function agentDurationMs(
  message: ChatMessage | undefined,
  agent: string,
): number | undefined {
  const step = (message?.parts ?? []).find(
    (p) =>
      p.type === "data-agent-step" &&
      p.data.agent === agent &&
      p.data.status === "done",
  );
  return step?.type === "data-agent-step" ? step.data.durationMs : undefined;
}

/** Derive a sub-agent's status from a message's parts: error wins, then an
 *  agent_done lifecycle step, otherwise still working. */
export function deriveAgentStatus(
  message: ChatMessage | undefined,
  agent: string,
): AgentStatus {
  const parts = message?.parts ?? [];
  const errored = parts.some(
    (p) =>
      p.type === "data-agent-progress" &&
      p.data.agent === agent &&
      p.data.phase === "error",
  );
  if (errored) return "error";
  const done = parts.some(
    (p) =>
      p.type === "data-agent-step" &&
      p.data.agent === agent &&
      p.data.status === "done",
  );
  return done ? "done" : "working";
}

export function AgentStatusBadge({
  status,
  className,
}: {
  status: AgentStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-normal",
        className,
      )}
    >
      {status === "working" && (
        <>
          <LoaderIcon className="size-3 animate-spin" /> Working
        </>
      )}
      {status === "done" && (
        <>
          <CheckIcon className="size-3 text-emerald-500" /> Completed
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircleIcon className="size-3 text-destructive" /> Failed
        </>
      )}
    </Badge>
  );
}

/** Streams a single sub-agent's full output — reasoning (collapsible, identical
 *  to the main thread) then the answer. */
export function AgentView({
  messages,
  agent,
  messageId,
}: {
  messages: ChatMessage[];
  agent: string;
  messageId: string;
}) {
  const message = findAgentMessage(messages, messageId, agent);
  const parts = message?.parts ?? [];
  const deltas = parts.filter(
    (p) => p.type === "data-agent-delta" && p.data.agent === agent,
  );
  const reasoning = deltas
    .map((p) =>
      p.type === "data-agent-delta" && p.data.kind === "reasoning"
        ? p.data.delta
        : "",
    )
    .join("");
  const text = deltas
    .map((p) =>
      p.type === "data-agent-delta" && p.data.kind === "text" ? p.data.delta : "",
    )
    .join("");

  const errorPart = parts.find(
    (p) =>
      p.type === "data-agent-progress" &&
      p.data.agent === agent &&
      p.data.phase === "error",
  );
  const errorMsg =
    errorPart?.type === "data-agent-progress" ? errorPart.data.message : undefined;
  const status = deriveAgentStatus(message, agent);

  return (
    <div className="space-y-5 text-sm text-foreground">
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span className="break-words font-mono leading-relaxed">
            {errorMsg}
          </span>
        </div>
      )}

      {!reasoning && !text ? (
        <p className="text-muted-foreground">
          {status === "error"
            ? `${agent} stopped before producing output.`
            : `Waiting for ${agent} to produce output…`}
        </p>
      ) : (
        <>
          {reasoning && (
            <Reasoning
              className="w-full"
              isStreaming={status === "working" && !text}
            >
              <ReasoningTrigger />
              <ReasoningContent>{reasoning}</ReasoningContent>
            </Reasoning>
          )}
          {text && <MessageResponse>{text}</MessageResponse>}
        </>
      )}
    </div>
  );
}
