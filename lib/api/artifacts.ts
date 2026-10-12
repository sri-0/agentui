"use client";

import { type QueryClient, useQuery } from "@tanstack/react-query";

import type { Artifact } from "@/lib/chat/types";

import { apiFetch, apiText } from "./client";
import type { ListResponse } from "./types";

const threadPath = (threadId: string) => `/v1/threads/${encodeURIComponent(threadId)}`;

/** The artifacts of a thread's conversation, newest first, without bodies.
 *  Refetched when a run ends (see ThreadChat). */
export function useThreadArtifacts(threadId: string) {
  return useQuery({
    queryKey: ["artifacts", threadId],
    staleTime: 30_000,
    queryFn: async () => (await apiFetch<ListResponse<Artifact>>(`${threadPath(threadId)}/artifacts`)).data ?? [],
  });
}

/** An artifact's body: from the event in threads from before artifacts were
 *  stored, else fetched once per version. A url artifact has none. Reload it
 *  with `invalidateArtifactBody`. */
export function useArtifactBody(threadId: string, artifact: Artifact) {
  const query = useQuery({
    queryKey: bodyKey(threadId, artifact.id, artifact.version),
    enabled: artifact.kind !== "url" && artifact.content == null,
    staleTime: Infinity,
    queryFn: () => apiText(`${threadPath(threadId)}/artifacts/${encodeURIComponent(artifact.id)}/content`),
  });
  return { body: artifact.content ?? query.data, error: query.error };
}

const bodyKey = (threadId: string, id: string, version?: number) =>
  version == null ? ["artifact-body", threadId, id] : ["artifact-body", threadId, id, version];

/** Fetch an artifact's body again. */
export function invalidateArtifactBody(queryClient: QueryClient, threadId: string, id: string) {
  return queryClient.invalidateQueries({ queryKey: bodyKey(threadId, id) });
}
