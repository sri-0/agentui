"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { Artifact } from "@/lib/chat/types";

import { apiFetch, apiText } from "./client";
import type { ListResponse } from "./types";

const threadPath = (threadId: string) => `/v1/threads/${encodeURIComponent(threadId)}`;

/** The artifacts of a thread's conversation, newest first, without bodies.
 *  Refetched when a run ends (ThreadChat) and when an artifact the panel
 *  opens is not in it (RightPanel). */
export function useThreadArtifacts(threadId: string) {
  return useQuery({
    queryKey: ["artifacts", threadId],
    queryFn: async () => (await apiFetch<ListResponse<Artifact>>(`${threadPath(threadId)}/artifacts`)).data ?? [],
  });
}

/** An artifact's body: from the event in threads from before artifacts were
 *  stored, else fetched once per version. A url artifact has none. Reload it
 *  by invalidating ["artifact-body", threadId, id]. */
export function useArtifactBody(threadId: string, artifact: Artifact) {
  const query = useQuery({
    queryKey: ["artifact-body", threadId, artifact.id, artifact.version ?? 0],
    enabled: artifact.kind !== "url" && artifact.content == null,
    staleTime: Infinity,
    queryFn: () => apiText(`${threadPath(threadId)}/artifacts/${encodeURIComponent(artifact.id)}/content`),
  });
  return { body: artifact.content ?? query.data, error: query.error };
}

/** An artifact in the list across conversations, with where it belongs. */
export type RecentArtifact = Artifact & {
  root_id: string;
  thread_id: string;
  thread_title: string;
  updated_at: string;
};

const recentPage = 50;

/** Artifacts across every conversation, newest first, a page at a time. */
export function useRecentArtifacts() {
  return useInfiniteQuery({
    queryKey: ["recent-artifacts"],
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const q = new URLSearchParams({ limit: String(recentPage) });
      if (pageParam) q.set("before", pageParam);
      return (await apiFetch<ListResponse<RecentArtifact>>(`/v1/artifacts?${q}`)).data ?? [];
    },
    getNextPageParam: (page) => (page.length < recentPage ? undefined : page.at(-1)?.updated_at),
  });
}
