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
import { useChatStore } from "@/lib/chat/store";
import { deriveRichUsage } from "@/lib/chat/usage";
import { useUiStore } from "@/stores/ui-store";
import { memo, useMemo } from "react";

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Token-usage control in the composer — the AI Elements `Context` popover
 * (percent ring trigger + hover breakdown of input/output tokens). It
 * subscribes to the thread itself so the memoized composer around it never
 * sees a changing prop; the shell below bails unless a total changes. The
 * denominator comes from the selected model, so switching model updates the
 * ring. Clicking the trigger opens the full usage side panel.
 */
export function ThreadUsageRing({
  threadId,
  onOpenUsage,
}: {
  threadId: string;
  onOpenUsage: () => void;
}) {
  const { data: models = [] } = useModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const contextWindow =
    models.find((m) => m.id === selectedModel)?.context_length ?? 128_000;
  const messages = useChatStore((s) => s.threads[threadId]?.messages);
  const usage = useMemo(
    () => (messages ? deriveRichUsage(messages, contextWindow) : null),
    [messages, contextWindow],
  );

  return (
    <UsageContextShell
      total={usage?.totalTokens ?? 0}
      window={contextWindow}
      input={usage?.inputTokens ?? 0}
      output={usage?.outputTokens ?? 0}
      reasoning={usage?.reasoningTokens ?? 0}
      onOpenUsage={onOpenUsage}
    />
  );
}

const UsageContextShell = memo(function UsageContextShell({
  total,
  window: ctxWindow,
  input,
  output,
  reasoning,
  onOpenUsage,
}: {
  total: number;
  window: number;
  input: number;
  output: number;
  reasoning: number;
  onOpenUsage: () => void;
}) {
  return (
    <Context usedTokens={total} maxTokens={ctxWindow}>
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
            <UsageRow label="Input" tokens={input} />
            <UsageRow label="Output" tokens={output} />
            {reasoning > 0 && <UsageRow label="Reasoning" tokens={reasoning} />}
          </div>
        </ContextContentBody>
      </ContextContent>
    </Context>
  );
});

function UsageRow({ label, tokens }: { label: string; tokens: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span>{compact.format(tokens)}</span>
    </div>
  );
}
