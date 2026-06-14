"use client";

import { ProviderIcon } from "@/components/provider-icon";
import { useAgents } from "@/lib/api/agents";
import { useModels } from "@/lib/api/models";
import { formatDuration } from "@/lib/dayjs";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { BotIcon } from "lucide-react";

function useModelInfo(message: ChatMessage) {
  const { data: models = [] } = useModels();
  const { data: agents = [] } = useAgents();
  const meta = message.metadata;
  if (!meta) return null;

  const agent = meta.agentId
    ? agents.find((a) => a.id === meta.agentId)
    : undefined;
  const modelId = meta.model ?? agent?.model;
  const modelName = modelId
    ? (models.find((m) => m.id === modelId)?.name ?? modelId)
    : undefined;

  if (!agent && !modelName) return null;
  return { agentName: agent?.name, modelName, modelId };
}

/**
 * Agent / model identity shown under a response — separate from the message
 * action buttons. Agents get a robot icon; models get their provider icon.
 */
export function MessageMeta({ message }: { message: ChatMessage }) {
  const info = useModelInfo(message);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const duration = message.metadata?.durationMs;
  if (!info) return null;

  return (
    <div className="flex select-none items-center gap-2.5 text-xs text-muted-foreground">
      {info.modelId && info.modelName && (
        <button
          type="button"
          onClick={() =>
            openSidepanel({ kind: "model", modelId: info.modelId! })
          }
          className="flex items-center gap-1.5 rounded transition-colors hover:text-foreground hover:underline"
        >
          <ProviderIcon modelId={info.modelId} className="size-3.5" />
          {info.modelName}
        </button>
      )}
      {info.agentName && (
        <span className="flex items-center gap-1.5">
          <BotIcon className="size-3.5 shrink-0" />
          {info.agentName}
        </span>
      )}
      {typeof duration === "number" && (
        <span className="text-muted-foreground/70">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}
