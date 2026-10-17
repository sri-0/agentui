"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageList } from "@/components/chat/messages/message-list";
import { useThread } from "@/components/chat/use-thread";
import { Badge } from "@/components/ui/badge";
import type { ThreadStatus } from "@/lib/chat/reduce";
import { cn } from "@/lib/utils";
import { AlertCircleIcon, CheckIcon, LoaderIcon } from "lucide-react";

export function AgentStatusBadge({
  status,
  className,
}: {
  status: ThreadStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-normal",
        className,
      )}
    >
      {status === "idle" && (
        <>
          <CheckIcon className="size-3 text-emerald-500" /> Completed
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircleIcon className="size-3 text-destructive" /> Failed
        </>
      )}
      {(status === "streaming" || status === "awaiting_input") && (
        <>
          <LoaderIcon className="size-3 animate-spin" /> Working
        </>
      )}
    </Badge>
  );
}

/** A sub-agent's own thread, live: the same transcript as the main view,
 *  without a composer. */
export function AgentView({ threadId }: { threadId: string }) {
  const { messages, status, loaded, approve } = useThread(threadId);

  return (
    <Conversation className="flex-1">
      <ConversationContent className="p-6">
        {loaded && messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Waiting for output…
          </p>
        ) : (
          <MessageList
            messages={messages}
            status={status}
            approve={approve}
          />
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
