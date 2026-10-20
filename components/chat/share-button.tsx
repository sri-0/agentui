"use client";

import { CopyButton } from "@/components/common/copy-button";
import { VisibilityField } from "@/components/common/visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useThreadRecord } from "@/lib/api/threads";
import { useUpdateThread } from "@/lib/api/workspaces";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { Share2Icon, UsersIcon } from "lucide-react";
import { useContext, useState } from "react";

/**
 * The thread header's Share, for the conversation's creator: a popover that
 * makes it Public (readable, by its link, by everyone with access to its
 * control set, who cannot write in it) or Only me, with the link to copy
 * while it is public. Anyone else sees whose it is instead: they are reading.
 */
export function ShareButton() {
  const threadId = useContext(ThreadIdContext) ?? "";
  const { data: thread } = useThreadRecord(threadId);
  const update = useUpdateThread();
  const [open, setOpen] = useState(false);
  if (!thread) return null;
  if (!thread.mine) {
    return (
      <Badge variant="secondary" className="gap-1 font-normal text-muted-foreground">
        <UsersIcon /> Shared by {thread.user_created_by ?? "someone"} · read only
      </Badge>
    );
  }
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/chat/${threadId}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" aria-label="Share the conversation">
          <Share2Icon className="size-4" />
          Share
        </Button>
      </PopoverTrigger>
      {open && (
        <PopoverContent align="end" className="flex w-80 flex-col gap-4">
          <VisibilityField
            label="Who can read it"
            value={thread.is_shared}
            onChange={(shared) => update.mutate({ threadId, isShared: shared })}
            disabled={update.isPending}
          />
          {thread.is_shared && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Link</span>
              <InputGroup>
                <InputGroupInput
                  readOnly
                  value={link}
                  aria-label="Link to the conversation"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <InputGroupAddon align="inline-end">
                  <CopyButton text={link} size="icon-xs" />
                </InputGroupAddon>
              </InputGroup>
              <p className="text-xs text-muted-foreground">
                Anyone with access can read the conversation at this link. Only you can write in it.
              </p>
            </div>
          )}
        </PopoverContent>
      )}
    </Popover>
  );
}
