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
import type { RichUsage } from "@/lib/chat/usage";
import { useUiStore } from "@/stores/ui-store";
import { memo } from "react";

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Token-usage control in the composer — the AI Elements `Context` popover
 * (percent ring trigger + hover breakdown of input/output tokens).
 * Reads the usage captured ONCE at stream completion (`lastUsage`, from
 * useAgentChat) rather than subscribing to per-chunk messages, so it re-renders
 * once per completed turn instead of ~20x/sec while streaming. The denominator
 * (`contextWindow`) is resolved LIVE from the selected model, so switching model
 * updates the ring without a stale window. Clicking the trigger opens the full
 * usage side panel. See AGENTS.md "Thread & chat-stream performance".
 */
export function ThreadUsageRing({
  lastUsage,
  onOpenUsage,
}: {
  lastUsage: RichUsage | null;
  onOpenUsage: () => void;
}) {
  const { data: models = [] } = useModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const contextWindow =
    models.find((m) => m.id === selectedModel)?.context_length ?? 128_000;

  // Raw token totals only (from lastUsage); the window comes from the live model.
  // The memoized shell bails unless a totals number or the window changes, so no
  // re-render happens during streaming (lastUsage updates only at onFinish).
  return (
    <UsageContextShell
      total={lastUsage?.totalTokens ?? 0}
      window={contextWindow}
      input={lastUsage?.inputTokens ?? 0}
      output={lastUsage?.outputTokens ?? 0}
      reasoning={lastUsage?.reasoningTokens ?? 0}
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
