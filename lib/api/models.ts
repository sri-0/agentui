"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useUiStore } from "@/stores/ui-store";

import { apiFetch } from "./client";
import type { ListResponse, Model } from "./types";

/** Every model the server lists, of every type; one request for all of them. */
const allModels = {
  queryKey: ["models"],
  staleTime: 5 * 60_000,
  queryFn: async () => (await apiFetch<ListResponse<Model>>("/v1/models")).data ?? [],
};

/** What a composer picks a model for: the chat (its runs) or images. */
export type ModelUse = "chat" | "image";

const forUse: Record<ModelUse, (models: Model[]) => Model[]> = {
  chat: (models) => models.filter((m) => m.type === "llm" || !m.type),
  image: (models) => models.filter((m) => m.type === "image"),
};

/** The models of one use; the chat's by default. */
export function useModels(use: ModelUse = "chat") {
  return useQuery({ ...allModels, select: forUse[use] });
}

/** The currently-selected model object (or undefined while loading / unset). */
export function useSelectedModel(): Model | undefined {
  const { data: models = [] } = useModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  return models.find((m) => m.id === selectedModel);
}

/** Whether the model reports a capability (tool_calling, vision, reasoning, …). */
export function hasCapability(model: Model | undefined, capability: string): boolean {
  return Boolean(model?.capabilities?.includes(capability));
}

export type ProviderGroup = { providerId: string; providerName: string; models: Model[] };

/** Group models by provider for the grouped selector. */
export function useGroupedModels(use: ModelUse = "chat") {
  const query = useModels(use);
  const groups = useMemo<ProviderGroup[]>(() => {
    const map = new Map<string, ProviderGroup>();
    for (const m of query.data ?? []) {
      const key = m.provider_id ?? "other";
      if (!map.has(key)) {
        map.set(key, {
          providerId: key,
          providerName: m.provider_name ?? key,
          models: [],
        });
      }
      map.get(key)!.models.push(m);
    }
    return [...map.values()].sort((a, b) =>
      a.providerName.localeCompare(b.providerName),
    );
  }, [query.data]);

  return { ...query, groups };
}
