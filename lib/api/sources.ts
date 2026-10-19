"use client";

import { queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";

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

/** A source in the list across conversations, with its conversation's title
 *  ("" once the conversation is deleted: its sources stay). */
export type RecentSource = Source & { id: string; thread_title: string };

/** Sources across every conversation (only cited ones, and only one
 *  workspace's conversations, when asked), newest first, a page at a time; a
 *  full page names the cursor of the next. Marked stale when a run ends. */
export function useRecentSources({ cited, workspace }: { cited?: boolean; workspace?: string }) {
  return useInfiniteQuery({
    queryKey: ["recent-sources", cited, workspace],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      apiFetch<ListResponse<RecentSource> & { next?: string }>(
        `/v1/sources?${new URLSearchParams({ ...(cited && { cited: "true" }), ...(workspace && { workspace }), ...(pageParam && { after: pageParam }) })}`,
      ),
    getNextPageParam: (page) => page.next || undefined,
  });
}

const sourcesPath = (threadId: string) => `/v1/threads/${encodeURIComponent(threadId)}/sources`;

/** Every source of a thread's conversation, by number. Refetched when a run
 *  ends (see ThreadChat). */
export function useThreadSources(threadId: string) {
  return useQuery(sourcesQuery(threadId));
}

/** One source from the conversation's list, so a chip re-renders only when
 *  its own source changes. */
export function useListedSource(threadId: string, number: number) {
  return useQuery({ ...sourcesQuery(threadId), select: (list) => list.find((s) => s.number === number) });
}

const sourcesQuery = (threadId: string) =>
  queryOptions({
    queryKey: ["sources", threadId],
    queryFn: async () => (await apiFetch<ListResponse<Source>>(sourcesPath(threadId))).data ?? [],
  });

/** One source, fetched when a citation is opened. */
export function useSource(threadId: string, number: number, enabled: boolean) {
  return useQuery({
    queryKey: ["sources", threadId, number],
    enabled,
    staleTime: Infinity, // a source never changes once recorded, apart from its citations
    queryFn: () => apiFetch<Source>(`${sourcesPath(threadId)}/${number}`),
  });
}
