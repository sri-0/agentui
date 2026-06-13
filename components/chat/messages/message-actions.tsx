"use client";

import {
  MessageAction,
  MessageActions as MessageActionsRow,
} from "@/components/ai-elements/message";
import { ProviderIcon } from "@/components/provider-icon";
import dayjs from "@/lib/dayjs";
import { useAgents } from "@/lib/api/agents";
import { useModels } from "@/lib/api/models";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  CopyIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { useState } from "react";

function messageText(message: ChatMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n\n");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const d = dayjs.duration(ms);
  if (ms < 60_000) return `${d.asSeconds().toFixed(1)}s`;
  return d.format("m[m] s[s]");
}

/** Resolve the model that produced this message to a friendly label + id. */
function useModelLabel(
  message: ChatMessage,
): { label: string; modelId?: string } | null {
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

  const label = agent
    ? modelName
      ? `${modelName} · ${agent.name} `
      : agent.name
    : (modelName ?? "");
  return { label, modelId };
}

export function MessageActions({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const model = useModelLabel(message);
  const openSidepanel = useUiStore((s) => s.openSidepanel);

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
    <div
      className={cn(
        "mt-1 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100",
        vote && "opacity-100",
      )}
    >
      <div className="flex items-center gap-0.5">
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
      {model?.label && (
        <button
          type="button"
          onClick={() =>
            model.modelId &&
            openSidepanel({ kind: "model", modelId: model.modelId })
          }
          disabled={!model.modelId}
          className="flex items-center gap-1.5 rounded px-1 text-xs text-muted-foreground transition-colors hover:text-foreground enabled:hover:underline"
        >
          <ProviderIcon modelId={model.modelId} className="size-3.5" />
          {model.label}
        </button>
      )}
      {typeof message.metadata?.durationMs === "number" && (
        <span className="select-none text-xs text-muted-foreground/70">
          {formatDuration(message.metadata.durationMs)}
        </span>
      )}
    </div>
  );
}
