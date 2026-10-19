"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceAvatar } from "@/components/workspaces/workspace-avatar";
import { useDeleteThread, useThreadRecord } from "@/lib/api/threads";
import { useUpdateThread, useWorkspaces } from "@/lib/api/workspaces";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { ArchiveIcon, EllipsisIcon, FolderIcon, PinIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext } from "react";

/** The thread header's "…" menu: pin, move to a workspace, archive (leaves the
 *  sidebar) and delete the conversation. */
export function ThreadMenu() {
  const threadId = useContext(ThreadIdContext) ?? "";
  const { data: thread } = useThreadRecord(threadId);
  const { data: workspaces = [] } = useWorkspaces();
  const update = useUpdateThread();
  const del = useDeleteThread();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Conversation options">
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => update.mutate({ threadId, pinned: !thread?.pinned })}>
          <PinIcon /> {thread?.pinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderIcon /> Move to workspace
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={thread?.workspace_id ?? ""}
              onValueChange={(id) => update.mutate({ threadId, workspaceId: id || null })}
            >
              <DropdownMenuRadioItem value="">No workspace</DropdownMenuRadioItem>
              {workspaces.map((w) => (
                <DropdownMenuRadioItem key={w.id} value={w.id}>
                  <WorkspaceAvatar workspace={w} size="sm" />
                  {w.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => update.mutate({ threadId, archived: !thread?.archived })}>
          <ArchiveIcon /> {thread?.archived ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => del.mutate(threadId, { onSuccess: () => router.push("/chat") })}
        >
          <Trash2Icon /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
