"use client";

import { useQuery } from "@tanstack/react-query";

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

/** An artifact's body. Threads from before artifacts were stored carry it in
 *  the event; everything else is fetched, again for each new version or
 *  refresh. A url artifact has no body. */
export function useArtifactBody(threadId: string, artifact: Artifact, refresh: number) {
  return useQuery({
    queryKey: ["artifact-body", threadId, artifact.id, artifact.version ?? 0, refresh],
    enabled: artifact.kind !== "url" && artifact.content == null,
    staleTime: Infinity,
    queryFn: () => apiText(`${threadPath(threadId)}/artifacts/${encodeURIComponent(artifact.id)}/content`),
  });
}
