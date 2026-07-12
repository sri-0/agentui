"use client";

import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getUserId } from "@/lib/api/client";
import { chatUrl } from "@/lib/chat/api";
import type { ChatMessage, ChatRequestBody } from "@/lib/chat/types";
import { deriveRichUsage, type RichUsage } from "@/lib/chat/usage";

export function useAgentChat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages?: ChatMessage[];
}) {
  const queryClient = useQueryClient();

  // Usage captured ONCE per completed turn (and seeded from history on mount),
  // NOT recomputed per streaming chunk. We store raw token totals (via
  // deriveRichUsage, which prefers the exact backend `data-usage` part) so the
  // ring can resolve `contextWindow` from the live selected model rather than a
  // possibly-stale denominator. See AGENTS.md "Thread & chat-stream perf".
  // contextWindow passed here is a placeholder — the ring uses the live model's
  // window, only the token TOTALS from this result are consumed.
  const [lastUsage, setLastUsage] = useState<RichUsage | null>(() =>
    initialMessages && initialMessages.length
      ? deriveRichUsage(initialMessages, 128_000)
      : null,
  );
  // Own the Chat instance (keyed by thread id) so secondary subscribers — e.g.
  // the live usage ring — can subscribe to the SAME instance via
  // useChat({ chat }) instead of spinning up a second, empty chat.
  const chat = useMemo(
    () =>
      new Chat<ChatMessage>({
        id,
        messages: initialMessages,
        // Thread creation is backend-side on the first user message, so a fresh
        // chat's thread doc only exists once a run finishes. Invalidate the
        // sidebar's thread list here so a brand-new conversation appears live
        // (with its provisional "New Chat" title) without a page reload. The
        // async-generated title is picked up shortly after by the list query's
        // refetchInterval (see useThreads).
        onFinish: ({ messages }) => {
          queryClient.invalidateQueries({ queryKey: ["threads"] });
          // Capture final usage exactly once, at stream end. deriveRichUsage
          // reads the backend `data-usage` part when present (exact) and falls
          // back to a text estimate. Stored as raw totals so the ring resolves
          // the denominator from the live model.
          setLastUsage(deriveRichUsage(messages, 128_000));
        },
        transport: new DefaultChatTransport<ChatMessage>({
          api: chatUrl(),
          // Talk DIRECTLY to the Go backend, which parses AI SDK UIMessages and
          // these snake_case fields. The per-send camelCase `body` (from
          // useRequestBody) is mapped to snake_case here; `messages` stays as
          // AI SDK UIMessages (the Go side converts them).
          prepareSendMessagesRequest: ({ messages, body, headers }) => {
            const b = (body ?? {}) as Partial<ChatRequestBody>;
            return {
              // Identity seam: the backend keys ALL per-user state (sessions,
              // resume, memory) by X-User-ID. The chat stream MUST carry the
              // same id as the REST apiFetch calls, or the stream runs as a
              // different backend user and session/resume matching breaks.
              headers: { ...headers, "X-User-ID": getUserId() },
              body: {
                messages,
                agent_id: b.agentId,
                model: b.model,
                thread_id: b.threadId,
                use_rag: b.useRag,
                temporary: b.temporary,
                reasoning_effort: b.reasoningEffort,
              },
            };
          },
        }),
      }),
    // The thread is keyed by id (ThreadView remounts on id change), so create once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  // experimental_throttle batches streaming updates (~20fps) so we re-render the
  // message subtree a few times/sec rather than per token. See AGENTS.md.
  const helpers = useChat<ChatMessage>({ chat, experimental_throttle: 50 });
  return { ...helpers, chat, lastUsage };
}
