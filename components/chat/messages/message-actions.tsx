"use client";

import {
  MessageAction,
  MessageActions as MessageActionsRow,
} from "@/components/ai-elements/message";
import { useAgents } from "@/lib/api/agents";
import { useModels } from "@/lib/api/models";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useState } from "react";

function messageText(message: ChatMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n\n");
}

/** Resolve the model that produced this message to a friendly label. */
function useModelLabel(message: ChatMessage): string | null {
  const { data: models = [] } = useModels();
  const { data: agents = [] } = useAgents();
  const meta = message.metadata;
  if (!meta) return null;

  const agent = meta.agentId
    ? agents.find((a) => a.id === meta.agentId)
    : undefined;
  const modelId = meta.model ?? agent?.model;
  if (!modelId && !agent) return null;

  const modelName = modelId
    ? (models.find((m) => m.id === modelId)?.name ?? modelId)
    : undefined;

  if (agent) return modelName ? `${agent.name} · ${modelName}` : agent.name;
  return modelName ?? null;
}

export function MessageActions({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const label = useModelLabel(message);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(messageText(message));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div
        className={cn(
          "flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
          vote && "opacity-100",
        )}
      >
        <MessageActionsRow>
          <MessageAction tooltip={copied ? "Copied" : "Copy"} onClick={copy}>
            {copied ? (
              <CheckIcon className="size-4 text-emerald-500" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </MessageAction>
          <MessageAction
            tooltip="Good response"
            onClick={() => setVote(vote === "up" ? null : "up")}
          >
            <ThumbsUpIcon
              className={cn("size-4", vote === "up" && "text-emerald-500")}
            />
          </MessageAction>
          <MessageAction
            tooltip="Bad response"
            onClick={() => setVote(vote === "down" ? null : "down")}
          >
            <ThumbsDownIcon
              className={cn("size-4", vote === "down" && "text-destructive")}
            />
          </MessageAction>
        </MessageActionsRow>
      </div>
      {label && (
        <span className="select-none text-xs text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
