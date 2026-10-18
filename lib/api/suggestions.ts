import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiFetch } from "./client";

/** NEXT_PUBLIC_SUGGESTIONS=off turns next-prompt suggestions off: none are
 *  asked for or shown. Read at build time, like every NEXT_PUBLIC_ var. */
const SUGGESTIONS_ON = process.env.NEXT_PUBLIC_SUGGESTIONS !== "off";

const DELAY = 1000; // ms a request must stay the same before it is sent

/** One message of the turn the suggestions follow from, as the UI shows it. */
export type SuggestMessage = { role: "user" | "assistant"; content: string };

/** What suggestions start from: the thread's last turn (the user's message and
 *  the answer, `messageId`), what is being typed, or both. */
export type SuggestFor = { messageId?: string; messages?: SuggestMessage[]; text?: string };

/**
 * Three next prompts (POST /v1/suggestions {messages, text}), asked for once
 * the request has stayed the same for DELAY: typing, or clicking through
 * threads, asks once where it stops. The turn is sent as the UI has it, so the
 * server never waits on its own copy. Kept for the session per answer and
 * text; a request the next one supersedes is aborted; one that fails shows
 * nothing and isn't asked again.
 */
export function useSuggestions(request: SuggestFor) {
  const { messageId, messages, text } = useSettled(request, DELAY);
  return useQuery({
    queryKey: ["suggestions", messageId ?? null, text ?? null],
    queryFn: ({ signal }) =>
      apiFetch<{ suggestions: string[] }>("/v1/suggestions", {
        method: "POST",
        body: JSON.stringify({ messages, text }),
        signal,
      }).then((r) => r.suggestions),
    enabled: SUGGESTIONS_ON && Boolean(text || messages?.length),
    staleTime: Infinity,
    placeholderData: (previous) => previous, // no flicker while the next ones load
    retry: false,
    retryOnMount: false,
  });
}

/** The request once it has stopped changing for ms; empty until then, so a
 *  composer that has just mounted waits too. The caller keeps messages the
 *  same array while messageId stays. */
function useSettled({ messageId, messages, text }: SuggestFor, ms: number): SuggestFor {
  const [settled, setSettled] = useState<SuggestFor>({});
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ messageId, messages, text }), ms);
    return () => clearTimeout(timer);
  }, [messageId, messages, text, ms]);
  return settled;
}
