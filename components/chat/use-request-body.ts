"use client";

import type { ChatRequestBody } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { useCallback } from "react";

/** Build the proxy request body from the current selection. */
export function useRequestBody(threadId: string, isTemporary: boolean) {
  const selectedModel = useUiStore((s) => s.selectedModel);
  const selectedAgentId = useUiStore((s) => s.selectedAgentId);
  const reasoningEffort = useUiStore((s) => s.reasoningEffort);

  return useCallback(
    (opts?: { hasFiles?: boolean }): ChatRequestBody => ({
      model: selectedModel ?? undefined,
      agentId: selectedAgentId ?? undefined,
      threadId: isTemporary ? undefined : threadId,
      temporary: isTemporary,
      useRag: Boolean(opts?.hasFiles),
      reasoningEffort: reasoningEffort === "off" ? undefined : reasoningEffort,
    }),
    [selectedModel, selectedAgentId, reasoningEffort, threadId, isTemporary],
  );
}
