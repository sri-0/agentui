"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { ListResponse } from "./types";

/** What a tool returned that an answer cites as [source:N], as the backend
 *  recorded it: the number is the conversation's, the rest is the system's. */
export type Source = {
  number: number;
  root_id: string;
  thread_id: string;
  tool: string;
  system: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  retrieved_at: string;
  /** "message:<id>" or "artifact:<id>" for each place that cites it. */
  cited_in?: string[];
};

const sourcesPath = (threadId: string) => `/v1/threads/${encodeURIComponent(threadId)}/sources`;

/** Every source of a thread's conversation, by number. Refetched when a run
 *  ends (see ThreadChat). */
export function useThreadSources(threadId: string) {
  return useQuery({ queryKey: ["sources", threadId], queryFn: () => listSources(threadId) });
}

/** One source from the conversation's list, so a chip re-renders only when
 *  its own source changes. */
export function useListedSource(threadId: string, number: number) {
  return useQuery({
    queryKey: ["sources", threadId],
    queryFn: () => listSources(threadId),
    select: (list) => list.find((s) => s.number === number),
  });
}

async function listSources(threadId: string) {
  return (await apiFetch<ListResponse<Source>>(sourcesPath(threadId))).data ?? [];
}

/** One source, fetched when a citation is opened. */
export function useSource(threadId: string, number: number, enabled: boolean) {
  return useQuery({
    queryKey: ["sources", threadId, number],
    enabled,
    staleTime: Infinity, // a source never changes once recorded, apart from its citations
    queryFn: () => apiFetch<Source>(`${sourcesPath(threadId)}/${number}`),
  });
}
