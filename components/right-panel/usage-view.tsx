"use client";

import { useModels } from "@/lib/api/models";
import type { ChatMessage } from "@/lib/chat/types";
import { deriveRichUsage } from "@/lib/chat/usage";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

import { Stat } from "./stat";

export function UsageView({
  messages,
  contextWindow,
}: {
  messages: ChatMessage[];
  contextWindow: number;
}) {
  const u = deriveRichUsage(messages, contextWindow);
  const { data: models = [] } = useModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const model = models.find((m) => m.id === selectedModel);

  const pct =
    u.contextWindow > 0 ? Math.min(u.totalTokens / u.contextWindow, 1) : 0;
  const dash = "—";
  const catTotal = u.categories.reduce((a, c) => a + c.tokens, 0) || 1;

  return (
    <div className="space-y-7">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Provider" value={model?.provider_name ?? dash} />
        <Stat label="Model" value={model?.name ?? model?.id ?? dash} />
        <Stat
          label="Context Limit"
          value={u.contextWindow ? u.contextWindow.toLocaleString() : dash}
        />
        <Stat label="Total Tokens" value={u.totalTokens.toLocaleString()} />
        <Stat label="Usage" value={`${Math.round(pct * 100)}%`} />
        <Stat label="Input Tokens" value={u.inputTokens.toLocaleString()} />
        <Stat label="Output Tokens" value={u.outputTokens.toLocaleString()} />
        <Stat
          label="Reasoning Tokens"
          value={u.reasoningTokens.toLocaleString()}
        />
        <Stat
          label="Cache Tokens"
          value={u.cacheTokens ? u.cacheTokens.toLocaleString() : dash}
        />
        <Stat label="User Messages" value={String(u.userMessages)} />
        <Stat label="Assistant Messages" value={String(u.assistantMessages)} />
        <Stat label="Total Cost" value={dash} />
      </dl>

      <div>
        <h3 className="mb-2.5 text-xs font-medium text-muted-foreground">
          Context Breakdown
        </h3>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {u.categories.map((c) => (
            <div
              key={c.label}
              className={c.color}
              style={{ width: `${(c.tokens / catTotal) * 100}%` }}
            />
          ))}
          {u.categories.length === 0 && <div className="w-full bg-muted" />}
        </div>
        <ul className="mt-3.5 space-y-2">
          {u.categories.map((c) => (
            <li
              key={c.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className={cn("size-2 rounded-full", c.color)} />
                {c.label}
              </span>
              <span className="font-mono text-xs tabular-nums">
                {Math.round((c.tokens / catTotal) * 100)}%
              </span>
            </li>
          ))}
          {u.categories.length === 0 && (
            <li className="text-xs text-muted-foreground">No usage yet.</li>
          )}
        </ul>
      </div>

      {!u.exact && (
        <p className="rounded-lg border border-dashed p-3 text-[11px] leading-relaxed text-muted-foreground">
          Token counts are estimated client-side. Exact usage, cache tokens and
          cost appear once the backend reports them.
        </p>
      )}
    </div>
  );
}
