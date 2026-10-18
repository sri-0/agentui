"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { Agent, ListResponse } from "./types";

/** The images agent (the backend's config/default/agents/images.md), whose one
 *  tool makes images; the Images page starts its conversations. */
export const IMAGES_AGENT = "images";

export function useAgents(options: { select?: (agents: Agent[]) => Agent[] } = {}) {
  return useQuery({
    queryKey: ["agents"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await apiFetch<ListResponse<Agent>>("/v1/agents");
      return res.data ?? [];
    },
    ...options,
  });
}
