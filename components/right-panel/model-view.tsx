"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import { ProviderIcon } from "@/components/provider-icon";
import { Badge } from "@/components/ui/badge";
import { useModels } from "@/lib/api/models";
import { providerForModel } from "@/lib/providers";
import { CheckIcon } from "lucide-react";

import { Stat } from "./stat";

const CAPABILITY_LABELS: Record<string, string> = {
  tool_calling: "Tools",
  vision: "Vision",
  reasoning: "Reasoning",
  structured_output: "Structured output",
};

/** One model: what its provider, discovery and model card say about it. */
export function ModelView({ modelId }: { modelId: string }) {
  const { data: models = [] } = useModels();
  const model = models.find((m) => m.id === modelId);
  const brand = providerForModel(modelId);
  const price = (n?: number) => (n == null ? "—" : `$${n} / M tokens`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/40">
          <ProviderIcon modelId={modelId} className="size-6" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{model?.name ?? modelId}</div>
          <div className="truncate text-xs text-muted-foreground">{brand.name}</div>
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <code className="break-all text-xs text-muted-foreground">{modelId}</code>
      </div>

      {model?.description && <p className="text-sm leading-relaxed text-muted-foreground">{model.description}</p>}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Provider" value={model?.provider_name ?? "—"} />
        <Stat label="Type" value={model?.type ? model.type.toUpperCase() : "—"} />
        <Stat label="Context length" value={model?.context_length?.toLocaleString() ?? "—"} />
        <Stat label="Max output" value={model?.max_output_tokens?.toLocaleString() ?? "—"} />
        <Stat label="Input price" value={price(model?.pricing?.input)} />
        <Stat label="Output price" value={price(model?.pricing?.output)} />
        <Stat label="Released" value={model?.release_date ?? "—"} />
        <Stat label="Knowledge cutoff" value={model?.knowledge_cutoff ?? "—"} />
        <Stat label="Owned by" value={model?.owned_by ?? "—"} />
        <Stat label="Licence" value={model?.license ?? "—"} />
      </dl>

      <div>
        <h3 className="mb-2.5 text-xs font-medium text-muted-foreground">Capabilities</h3>
        {model?.capabilities?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {model.capabilities.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1">
                <CheckIcon className="size-3 text-emerald-500" />
                {CAPABILITY_LABELS[c] ?? c}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{model ? "None reported." : "Model not found."}</p>
        )}
      </div>

      {model?.benchmarks && Object.keys(model.benchmarks).length > 0 && (
        <div>
          <h3 className="mb-2.5 text-xs font-medium text-muted-foreground">Benchmarks</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
            {Object.entries(model.benchmarks).map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-muted-foreground">{name.replaceAll("_", " ")}</dt>
                <dd className="text-right tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {model?.notes && (
        <div className="text-sm">
          <MessageResponse mode="static">{model.notes}</MessageResponse>
        </div>
      )}

      {model?.sources?.length ? (
        <ul className="space-y-1 text-xs">
          {model.sources.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-muted-foreground hover:underline">
                {url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
