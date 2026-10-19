"use client";

import { WorkspaceAvatar } from "@/components/workspaces/workspace-avatar";
import { WorkspaceCommand } from "@/components/workspaces/workspace-command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useThreadRecord } from "@/lib/api/threads";
import { useUpdateThread, useWorkspaces } from "@/lib/api/workspaces";
import { useUiStore } from "@/stores/ui-store";
import { ChevronDownIcon, FolderIcon } from "lucide-react";
import { memo, useState } from "react";

/**
 * The bevelled card tucked under the composer that shows, and picks, the
 * workspace the conversation is filed under: the thread's own when there is
 * one, else the one the next new conversation goes into. It subscribes to
 * what it shows itself, so the thread view passes only the thread id.
 */
export const WorkspaceBar = memo(function WorkspaceBar({ threadId }: { threadId?: string }) {
  const [open, setOpen] = useState(false);
  const { data: workspaces = [] } = useWorkspaces();
  const { data: thread } = useThreadRecord(threadId);
  const newChatWorkspaceId = useUiStore((s) => s.newChatWorkspaceId);
  const setNewChatWorkspace = useUiStore((s) => s.setNewChatWorkspace);
  const move = useUpdateThread();

  const currentId = threadId ? thread?.workspace_id : newChatWorkspaceId;
  const current = workspaces.find((w) => w.id === currentId);

  const choose = (id: string | null) => {
    setOpen(false);
    if (id === (currentId ?? null)) return;
    if (threadId) move.mutate({ threadId, workspaceId: id });
    else setNewChatWorkspace(id);
  };

  return (
    <div className="relative z-0 mx-auto -mt-4 flex w-[calc(100%-2.75rem)] items-center rounded-b-2xl bg-neutral-200/80 px-2 pt-5 pb-1.5 dark:bg-neutral-800">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Workspace: ${current?.name ?? "none"}`}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-300/70 hover:text-foreground dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {current ? <WorkspaceAvatar workspace={current} size="xs" /> : <FolderIcon className="size-3.5" />}
            <span className="max-w-[240px] truncate">{current?.name ?? "No workspace"}</span>
            <ChevronDownIcon className="size-3 opacity-50" />
          </button>
        </PopoverTrigger>
        {open && (
          <PopoverContent align="start" className="w-[260px] p-0">
            <WorkspaceCommand workspaces={workspaces} currentId={current?.id ?? null} onChoose={choose} />
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
});
