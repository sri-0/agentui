"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiFetch } from "./client";
import type { ListResponse, Model } from "./types";

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await apiFetch<ListResponse<Model>>("/v1/models");
      // only chat-capable models are selectable in the composer
      return (res.data ?? []).filter((m) => m.type === "llm" || !m.type);
    },
  });
}

export type ProviderGroup = { providerId: string; providerName: string; models: Model[] };

/** Group models by provider for the grouped selector. */
export function useGroupedModels() {
  const query = useModels();
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
