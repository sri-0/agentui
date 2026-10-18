import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiError, apiFetch } from "./client";

/** NEXT_PUBLIC_SUGGESTIONS=off turns next-prompt suggestions off: none are
 *  asked for or shown. Read at build time, like every NEXT_PUBLIC_ var. */
const SUGGESTIONS_ON = process.env.NEXT_PUBLIC_SUGGESTIONS !== "off";

const DELAY = 600; // ms a request must stay the same before it is sent

/** What suggestions start from: the thread the composer is in (its last answer,
 *  `messageId`), what is being typed, or both. */
export type SuggestFor = { threadId?: string; messageId?: string; text?: string };

/**
 * Three next prompts (POST /v1/suggestions), asked for once the request has
 * stayed the same for DELAY: typing, or clicking through threads, asks once
 * where it stops. For a thread's answer they are kept for the session; a
 * request the next one supersedes is aborted. The server stores an answer as
 * its run ends, so a 409 (not stored yet) is tried again shortly, and a thread
 * that still has none isn't asked again when the composer remounts.
 */
export function useSuggestions(request: SuggestFor) {
  const { threadId, messageId, text } = useSettled(request, DELAY);
  return useQuery({
    queryKey: ["suggestions", threadId ?? null, text ? { text } : { messageId }],
    queryFn: ({ signal }) =>
      apiFetch<{ suggestions: string[] }>("/v1/suggestions", {
        method: "POST",
        body: JSON.stringify({ threadId, text }),
        signal,
      }).then((r) => r.suggestions),
    enabled: SUGGESTIONS_ON && Boolean(text || (threadId && messageId)),
    staleTime: Infinity,
    placeholderData: (previous) => previous, // no flicker while the next ones load
    retry: (failures, err) => err instanceof ApiError && err.status === 409 && failures < 2,
    retryDelay: (attempt) => 1500 * 2 ** attempt,
    retryOnMount: false,
  });
}

/** The request once it has stopped changing for ms; empty until then, so a
 *  composer that has just mounted waits too. */
function useSettled({ threadId, messageId, text }: SuggestFor, ms: number): SuggestFor {
  const [settled, setSettled] = useState<SuggestFor>({});
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ threadId, messageId, text }), ms);
    return () => clearTimeout(timer);
  }, [threadId, messageId, text, ms]);
  return settled;
}
