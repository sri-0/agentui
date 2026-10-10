"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { Connector, ListResponse } from "./types";

export function useConnectors() {
  return useQuery({
    queryKey: ["connectors"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await apiFetch<ListResponse<Connector>>("/v1/connectors");
      return res.data ?? [];
    },
  });
}

/** One connector in full; an MCP connector's tools come from the server. */
export function useConnector(id: string) {
  return useQuery({
    queryKey: ["connectors", id],
    staleTime: 60_000,
    queryFn: () => apiFetch<Connector>(`/v1/connectors/${encodeURIComponent(id)}`),
  });
}
