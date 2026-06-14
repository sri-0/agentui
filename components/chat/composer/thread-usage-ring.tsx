"use client";

import { useModels } from "@/lib/api/models";
import type { ChatMessage } from "@/lib/chat/types";
import { deriveUsage } from "@/lib/chat/usage";
import { useUiStore } from "@/stores/ui-store";
import { type Chat, useChat } from "@ai-sdk/react";

import { ContextCircle } from "./context-circle";

/**
 * Live token-usage ring. Subscribes to the SAME chat instance (passed in) so it
 * re-renders on streaming updates IN ISOLATION — the composer shell does not
 * take a `usage` prop and therefore stays memoized during streaming.
 * See AGENTS.md "Thread & chat-stream performance".
 */
export function ThreadUsageRing({
  chat,
  onOpenUsage,
}: {
  chat: Chat<ChatMessage>;
  onOpenUsage: () => void;
}) {
  const { messages } = useChat<ChatMessage>({ chat });
  const { data: models = [] } = useModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const contextWindow =
    models.find((m) => m.id === selectedModel)?.context_length ?? 128_000;
  const usage = deriveUsage(messages, contextWindow);

  return (
    <ContextCircle
      used={usage.used}
      total={usage.total}
      onClick={onOpenUsage}
    />
  );
}
