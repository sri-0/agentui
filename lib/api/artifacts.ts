"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { Artifact } from "@/lib/chat/types";

import { API_URL, apiFetch, apiText } from "./client";
import type { ListResponse } from "./types";

const threadPath = (threadId: string) => `/v1/threads/${encodeURIComponent(threadId)}`;

/** Where an artifact's body is served, for an <img> (each version its own URL). */
export function artifactUrl(threadId: string, artifact: Pick<Artifact, "id" | "version">) {
  return `${API_URL}${threadPath(threadId)}/artifacts/${encodeURIComponent(artifact.id)}/content?v=${artifact.version ?? 0}`;
}

/** The artifacts of a thread's conversation (none for ""), newest first,
 *  without bodies. Refetched when a run ends (ThreadChat) and when an artifact
 *  the panel opens is not in it (RightPanel). */
export function useThreadArtifacts(threadId: string) {
  return useQuery({
    queryKey: ["artifacts", threadId],
    enabled: threadId !== "",
    queryFn: async () => (await apiFetch<ListResponse<Artifact>>(`${threadPath(threadId)}/artifacts`)).data ?? [],
  });
}

/** An artifact's body: from the event in threads from before artifacts were
 *  stored, else fetched once per version (once `enabled`). A url artifact has
 *  none, and an image is shown from its URL. Reload it by invalidating
 *  ["artifact-body", threadId, id]. */
export function useArtifactBody(threadId: string, artifact: Artifact, enabled = true) {
  const query = useQuery({
    queryKey: ["artifact-body", threadId, artifact.id, artifact.version ?? 0],
    enabled: enabled && artifact.kind !== "url" && artifact.kind !== "image" && artifact.content == null,
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

/** Artifacts across every conversation (of one kind, and of one workspace's
 *  conversations, when given), newest first, a page at a time; a full page
 *  names the cursor of the next. Marked stale when a run ends. */
export function useRecentArtifacts(kind?: Artifact["kind"], workspace?: string) {
  return useInfiniteQuery({
    queryKey: ["recent-artifacts", kind, workspace],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      apiFetch<ListResponse<RecentArtifact> & { next?: string }>(
        `/v1/artifacts?${new URLSearchParams({ ...(kind && { kind }), ...(workspace && { workspace }), ...(pageParam && { after: pageParam }) })}`,
      ),
    getNextPageParam: (page) => page.next || undefined,
  });
}
