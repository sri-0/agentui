"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import { ProviderIcon } from "@/components/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModels } from "@/lib/api/models";
import { providerForModel } from "@/lib/providers";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";
import { deriveRichUsage } from "@/lib/chat/usage";
import { useUiStore } from "@/stores/ui-store";
import { CheckIcon, XIcon } from "lucide-react";

export function RightPanel({
  messages,
  contextWindow,
}: {
  messages: ChatMessage[];
  contextWindow: number;
}) {
  const sidepanel = useUiStore((s) => s.sidepanel);
  const close = useUiStore((s) => s.closeSidepanel);

  if (!sidepanel) return null;

  return (
    <aside className="flex h-full flex-col border-l bg-card/30">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-5">
        <h2 className="truncate text-sm font-semibold">
          {sidepanel.kind === "usage" && "Context"}
          {sidepanel.kind === "agent" && sidepanel.agent}
          {sidepanel.kind === "artifact" && "Artifact"}
          {sidepanel.kind === "model" && "Model"}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={close}>
          <XIcon className="size-4" />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        {sidepanel.kind === "usage" && (
          <UsageView messages={messages} contextWindow={contextWindow} />
        )}
        {sidepanel.kind === "agent" && (
          <AgentView
            messages={messages}
            agent={sidepanel.agent}
            messageId={sidepanel.messageId}
          />
        )}
        {sidepanel.kind === "artifact" && (
          <ArtifactView messages={messages} artifactId={sidepanel.artifactId} />
        )}
        {sidepanel.kind === "model" && (
          <ModelView modelId={sidepanel.modelId} />
        )}
      </div>
    </aside>
  );
}

function UsageView({
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
    u.contextWindow > 0
      ? Math.min(u.totalTokens / u.contextWindow, 1)
      : 0;
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function AgentView({
  messages,
  agent,
  messageId,
}: {
  messages: ChatMessage[];
  agent: string;
  messageId: string;
}) {
  const message = messages.find((m) => m.id === messageId);
  const stream = message?.parts.find(
    (p) => p.type === "data-agent-stream" && p.data.agent === agent,
  );
  const text =
    stream && stream.type === "data-agent-stream" ? stream.data.text : "";

  if (!text) {
    return (
      <p className="text-sm text-muted-foreground">
        Waiting for {agent} to produce output…
      </p>
    );
  }
  return <MessageResponse>{text}</MessageResponse>;
}

function ArtifactView({
  messages,
  artifactId,
}: {
  messages: ChatMessage[];
  artifactId: string;
}) {
  let artifact: ChatMessage["parts"][number] | undefined;
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "data-artifact" && p.data.id === artifactId) artifact = p;
    }
  }
  if (!artifact || artifact.type !== "data-artifact") {
    return <p className="text-sm text-muted-foreground">Artifact not found.</p>;
  }
  const { kind, content, language } = artifact.data;
  const md =
    kind === "code"
      ? `\`\`\`${language ?? ""}\n${content}\n\`\`\``
      : kind === "json"
        ? `\`\`\`json\n${content}\n\`\`\``
        : content;
  return <MessageResponse>{md}</MessageResponse>;
}

function ModelView({ modelId }: { modelId: string }) {
  const { data: models = [] } = useModels();
  const model = models.find((m) => m.id === modelId);
  const provider = providerForModel(modelId);

  const capabilities = model
    ? ([
        ["Vision", model.vision],
        ["Tools", model.tools],
        ["Reasoning", model.reasoning],
        ["Audio", model.audio],
        ["Multimodal", model.multimodal],
      ] as const).filter(([, on]) => on)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/40">
          <ProviderIcon modelId={modelId} className="size-6" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">
            {model?.name ?? modelId}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {provider.name}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <code className="break-all text-xs text-muted-foreground">
          {modelId}
        </code>
      </div>

      {model?.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {model.description}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Provider" value={model?.provider_name ?? provider.name} />
        <Stat
          label="Type"
          value={model?.type ? model.type.toUpperCase() : "—"}
        />
        <Stat
          label="Context Length"
          value={
            model?.context_length ? model.context_length.toLocaleString() : "—"
          }
        />
        <Stat label="Owned By" value={(model?.provider_id as string) ?? "—"} />
      </dl>

      <div>
        <h3 className="mb-2.5 text-xs font-medium text-muted-foreground">
          Capabilities
        </h3>
        {capabilities.length ? (
          <div className="flex flex-wrap gap-1.5">
            {capabilities.map(([name]) => (
              <Badge key={name} variant="secondary" className="gap-1">
                <CheckIcon className="size-3 text-emerald-500" />
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {model ? "No special capabilities reported." : "Model not found."}
          </p>
        )}
      </div>
    </div>
  );
}
