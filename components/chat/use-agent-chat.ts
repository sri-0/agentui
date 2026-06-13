"use client";

import { useChat } from "@ai-sdk/react";
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
  const transport = useMemo(
    () => new DefaultChatTransport<ChatMessage>({ api: "/api/chat" }),
    [],
  );

  return useChat<ChatMessage>({
    id,
    messages: initialMessages,
    transport,
  });
}
