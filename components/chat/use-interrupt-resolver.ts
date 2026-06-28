"use client";

import { resumeUrl } from "@/lib/chat/api";
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
 * answer) back into the interrupted assistant message.
 *
 * Robust to tool-call ids being REUSED across turns (some models reset them per
 * turn): it targets the MOST RECENT message whose tool call is still awaiting
 * approval — not the first id match, which could be an older, already-resolved
 * card. It also doesn't require the interrupt side-channel to exist (it derives
 * the backend thread id from it when present, else the route thread id).
 */
export function useInterruptResolver(
  threadId: string,
  messages: ChatMessage[],
  setMessages: SetMessages,
): ResolveInterrupt {
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  return useCallback<ResolveInterrupt>(
    async (toolCallId, action) => {
      const msgs = messagesRef.current;

      // Most recent message whose tool call `toolCallId` is still pending.
      let original: ChatMessage | undefined;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const pending = m.parts.some(
          (p) =>
            (p.type === "dynamic-tool" &&
              p.toolCallId === toolCallId &&
              p.state === "approval-requested") ||
            (p.type === "data-tool-interrupt" &&
              p.data.toolCallId === toolCallId &&
              !p.data.resolved),
        );
        if (pending) {
          original = m;
          break;
        }
      }
      if (!original) return;

      // Backend resume is keyed by thread id: prefer the interrupt's recorded
      // one, fall back to the route thread id.
      const interruptPart = original.parts.find(
        (p) =>
          p.type === "data-tool-interrupt" && p.data.toolCallId === toolCallId,
      );
      const backendThreadId =
        (interruptPart?.type === "data-tool-interrupt"
          ? interruptPart.data.threadId
          : undefined) ?? threadId;

      // Record the decision on the interrupt part so the card flips out of the
      // pending state immediately and keeps the Approved/Rejected badge after.
      const target: ChatMessage = {
        ...original,
        parts: original.parts.map((p) =>
          p.type === "data-tool-interrupt" && p.data.toolCallId === toolCallId
            ? { ...p, data: { ...p.data, resolved: action } }
            : p,
        ),
      };
      setMessages((prev) => prev.map((m) => (m.id === target.id ? target : m)));

      // Resume goes DIRECTLY to the Go backend, which returns the same native
      // v6 stream. Body is snake_case `{ thread_id, action }`.
      const res = await fetch(resumeUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          thread_id: backendThreadId,
          action,
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
    [threadId, setMessages],
  );
}
