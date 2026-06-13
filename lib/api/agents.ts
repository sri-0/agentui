"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { Agent, ListResponse } from "./types";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await apiFetch<ListResponse<Agent>>("/v1/agents");
      return res.data ?? [];
    },
  });
}
