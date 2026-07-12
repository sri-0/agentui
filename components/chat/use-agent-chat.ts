"use client";

import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

import { getUserId } from "@/lib/api/client";
import { chatUrl } from "@/lib/chat/api";
import type { ChatMessage, ChatRequestBody } from "@/lib/chat/types";

export function useAgentChat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages?: ChatMessage[];
}) {
  // Own the Chat instance (keyed by thread id) so secondary subscribers — e.g.
  // the live usage ring — can subscribe to the SAME instance via
  // useChat({ chat }) instead of spinning up a second, empty chat.
  const chat = useMemo(
    () =>
      new Chat<ChatMessage>({
        id,
        messages: initialMessages,
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
  return { ...helpers, chat };
}
