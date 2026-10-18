import { useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./client";

/** What suggestions start from: the thread the composer is in (its last answer,
 *  `messageId`), what is being typed, or both. */
export type SuggestFor = { threadId?: string; messageId?: string; text?: string };

/**
 * Three next prompts (POST /v1/suggestions). For a thread's answer they are
 * asked once per answer and kept for the session; for typed text, once per
 * text, and a request the next keystroke supersedes is aborted. The server
 * stores an answer as its run ends, so a 409 (not stored yet) is tried again
 * shortly.
 */
export function useSuggestions({ threadId, messageId, text }: SuggestFor) {
  return useQuery({
    queryKey: ["suggestions", threadId ?? null, text ? { text } : { messageId }],
    queryFn: ({ signal }) =>
      apiFetch<{ suggestions: string[] }>("/v1/suggestions", {
        method: "POST",
        body: JSON.stringify({ threadId, text }),
        signal,
      }).then((r) => r.suggestions),
    enabled: Boolean(text || (threadId && messageId)),
    staleTime: Infinity,
    placeholderData: (previous) => previous, // no flicker while the next ones load
    retry: (failures, err) => err instanceof ApiError && err.status === 409 && failures < 3,
    retryDelay: 1000,
  });
}
