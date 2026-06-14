"use client";

import {
  MessageAction,
  MessageActions as MessageActionsRow,
} from "@/components/ai-elements/message";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useState } from "react";

function messageText(message: ChatMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n\n");
}

/** Copy to clipboard — available on both sides of the conversation. */
function CopyAction({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(messageText(message));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <MessageAction tooltip={copied ? "Copied" : "Copy"} onClick={copy}>
      {copied ? (
        <CheckIcon className="size-4 text-emerald-500" />
      ) : (
        <CopyIcon className="size-4" />
      )}
    </MessageAction>
  );
}

/** Thumbs up/down feedback — only meaningful for assistant responses. */
function FeedbackActions() {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  return (
    <>
      <MessageAction
        tooltip="Good response"
        onClick={() => setVote(vote === "up" ? null : "up")}
      >
        <ThumbsUpIcon
          className={cn("size-4", vote === "up" && "text-emerald-500")}
        />
      </MessageAction>
      <MessageAction
        tooltip="Bad response"
        onClick={() => setVote(vote === "down" ? null : "down")}
      >
        <ThumbsDownIcon
          className={cn("size-4", vote === "down" && "text-destructive")}
        />
      </MessageAction>
    </>
  );
}

/**
 * Row of message actions, tailored to which side of the conversation the message
 * is on. The model/agent identity lives in MessageMeta. Add new per-role actions
 * inside the relevant branch below.
 */
export function MessageActions({
  message,
  role = message.role,
}: {
  message: ChatMessage;
  role?: ChatMessage["role"];
}) {
  return (
    <div className="flex items-center gap-0.5">
      <MessageActionsRow>
        <CopyAction message={message} />
        {role === "assistant" && <FeedbackActions />}
      </MessageActionsRow>
    </div>
  );
}
