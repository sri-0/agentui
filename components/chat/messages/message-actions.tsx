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

/** Copy / feedback actions only — the model/agent identity lives in MessageMeta. */
export function MessageActions({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

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
    <div className="flex items-center gap-0.5">
      <MessageActionsRow>
        <MessageAction tooltip={copied ? "Copied" : "Copy"} onClick={copy}>
          {copied ? (
            <CheckIcon className="size-4 text-emerald-500" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </MessageAction>
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
      </MessageActionsRow>
    </div>
  );
}
