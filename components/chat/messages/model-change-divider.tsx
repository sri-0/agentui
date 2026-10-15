"use client";

import { ProviderIcon } from "@/components/provider-icon";
import { useModels } from "@/lib/api/models";
import type { ModelChange } from "@/lib/chat/types";
import { memo } from "react";

import { ThreadRule } from "./thread-rule";

/** Where the conversation moved to another model (the `model` activity),
 *  marked by the first turn that ran on it. */
export const ModelChangeDivider = memo(function ModelChangeDivider({ data }: { data: ModelChange }) {
  const { data: models = [] } = useModels();
  const name = models.find((m) => m.id === data.to)?.name ?? data.to;
  return (
    <div className="my-2">
      <ThreadRule>
        <ProviderIcon modelId={data.to} className="size-3.5" />
        <span className="truncate" title={data.to}>
          Changed model to {name}
        </span>
      </ThreadRule>
    </div>
  );
});
