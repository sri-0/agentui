"use client";

import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

import type { ChatMessage } from "@/lib/chat/types";

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
        transport: new DefaultChatTransport<ChatMessage>({ api: "/api/chat" }),
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
