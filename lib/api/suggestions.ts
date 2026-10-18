import { useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./client";

/**
 * Three next prompts for a thread's answer (POST /v1/threads/{id}/suggestions),
 * asked once per answer and kept for the session. The server stores the
 * answer as its run ends, so a 409 (not stored yet) is tried again shortly.
 */
export function useSuggestions(threadId: string, messageId: string | undefined) {
  return useQuery({
    queryKey: ["suggestions", threadId, messageId],
    queryFn: () =>
      apiFetch<{ suggestions: string[] }>(`/v1/threads/${threadId}/suggestions`, { method: "POST" }).then(
        (r) => r.suggestions,
      ),
    enabled: Boolean(messageId),
    staleTime: Infinity,
    retry: (failures, err) => err instanceof ApiError && err.status === 409 && failures < 3,
    retryDelay: 1000,
  });
}
