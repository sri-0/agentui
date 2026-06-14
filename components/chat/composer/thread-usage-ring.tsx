"use client";

import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextIcon,
  ContextTrigger,
} from "@/components/ai-elements/context";
import { useModels } from "@/lib/api/models";
import type { ChatMessage } from "@/lib/chat/types";
import { deriveRichUsage } from "@/lib/chat/usage";
import { useUiStore } from "@/stores/ui-store";
import { type Chat, useChat } from "@ai-sdk/react";

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Live token-usage control in the composer — the AI Elements `Context` popover
 * (percent ring trigger + hover breakdown of input/output tokens).
 * Subscribes to the SAME chat instance (passed in) so it re-renders on streaming
 * updates IN ISOLATION — the composer shell stays memoized during streaming.
 * Clicking the trigger opens the full usage side panel.
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

  const u = deriveRichUsage(messages, contextWindow);

  return (
    <Context usedTokens={u.totalTokens} maxTokens={u.contextWindow}>
      <ContextTrigger>
        <button
          type="button"
          onClick={onOpenUsage}
          aria-label="Context usage"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ContextIcon />
        </button>
      </ContextTrigger>
      <ContextContent>
        <ContextContentHeader />
        <ContextContentBody>
          <div className="space-y-2">
            <UsageRow label="Input" tokens={u.inputTokens} />
            <UsageRow label="Output" tokens={u.outputTokens} />
            {u.reasoningTokens > 0 && (
              <UsageRow label="Reasoning" tokens={u.reasoningTokens} />
            )}
          </div>
        </ContextContentBody>
      </ContextContent>
    </Context>
  );
}

function UsageRow({ label, tokens }: { label: string; tokens: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span>{compact.format(tokens)}</span>
    </div>
  );
}
