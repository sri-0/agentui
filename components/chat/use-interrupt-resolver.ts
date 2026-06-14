"use client";

import { sseToChunkStream } from "@/lib/chat/sse-to-chunks";
import type { ChatMessage } from "@/lib/chat/types";
import { readUIMessageStream } from "ai";
import { useCallback, useRef } from "react";

import type { ResolveInterrupt } from "./interrupt-context";

type SetMessages = (
  arg: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
) => void;

/**
 * Builds the HITL interrupt resolver: posts the approve/deny decision to the
 * resume proxy, then merges the streamed continuation (tool result + final
 * answer) back into the interrupted assistant message via readUIMessageStream.
 */
export function useInterruptResolver(
  messages: ChatMessage[],
  setMessages: SetMessages,
): ResolveInterrupt {
  // Read latest messages without re-creating the callback each render.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  return useCallback<ResolveInterrupt>(
    async (toolCallId, threadId, action) => {
      const original = messagesRef.current.find((m) =>
        m.parts.some(
          (p) =>
            p.type === "data-tool-interrupt" &&
            p.data.toolCallId === toolCallId,
        ),
      );
      // Record the decision on the interrupt part: flips the card out of the
      // pending state immediately and keeps the Approved/Rejected badge after
      // the tool completes. Continue the resume from this updated message.
      const target = original
        ? {
            ...original,
            parts: original.parts.map((p) =>
              p.type === "data-tool-interrupt" &&
              p.data.toolCallId === toolCallId
                ? { ...p, data: { ...p.data, resolved: action } }
                : p,
            ),
          }
        : undefined;
      if (target) {
        setMessages((prev) =>
          prev.map((m) => (m.id === target.id ? target : m)),
        );
      }

      const res = await fetch("/api/chat/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          action,
          model: target?.metadata?.model,
          agentId: target?.metadata?.agentId,
        }),
      });
      if (!res.ok || !res.body) return;

      // Continue the interrupted assistant message: the resume stream's
      // tool-output-available (matched by toolCallId) + final text merge in.
      for await (const msg of readUIMessageStream<ChatMessage>({
        message: target,
        stream: sseToChunkStream(res.body),
      })) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === msg.id);
          if (idx === -1) return [...prev, msg];
          const copy = prev.slice();
          copy[idx] = msg;
          return copy;
        });
      }
    },
    [setMessages],
  );
}
