"use client";

import { ProviderIcon } from "@/components/provider-icon";
import { Badge } from "@/components/ui/badge";
import { useModels } from "@/lib/api/models";
import { providerForModel } from "@/lib/providers";
import { CheckIcon } from "lucide-react";

import { Stat } from "./stat";

export function ModelView({ modelId }: { modelId: string }) {
  const { data: models = [] } = useModels();
  const model = models.find((m) => m.id === modelId);
  const provider = providerForModel(modelId);

  const capabilities = model
    ? (
        [
          ["Vision", model.vision],
          ["Tools", model.tools],
          ["Reasoning", model.reasoning],
          ["Audio", model.audio],
          ["Multimodal", model.multimodal],
        ] as const
      ).filter(([, on]) => on)
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
        <Stat label="Type" value={model?.type ? model.type.toUpperCase() : "—"} />
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
