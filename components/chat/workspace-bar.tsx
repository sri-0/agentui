"use client";

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useThreadRecord } from "@/lib/api/threads";
import type { Workspace } from "@/lib/api/types";
import { useCreateWorkspace, useMoveThread, useWorkspaces } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { CheckIcon, ChevronDownIcon, FolderIcon, FolderPlusIcon } from "lucide-react";
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
  const move = useMoveThread();

  const currentId = threadId ? thread?.workspace_id : newChatWorkspaceId;
  const current = workspaces.find((w) => w.id === currentId);

  const choose = (id: string | null) => {
    setOpen(false);
    if (id === (currentId ?? null)) return;
    if (threadId) move.mutate({ threadId, workspaceId: id });
    else setNewChatWorkspace(id);
  };

  return (
    <div className="relative z-0 mx-auto -mt-4 flex w-[calc(100%-2.75rem)] items-center rounded-b-2xl border border-t-0 border-border bg-muted px-2 pt-5 pb-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Workspace: ${current?.name ?? "none"}`}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-background hover:text-foreground"
          >
            <FolderIcon className="size-3.5" />
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

/** The workspaces to choose from, plus "No workspace", and a create item for a
 *  name typed that no workspace has. */
function WorkspaceCommand({
  workspaces,
  currentId,
  onChoose,
}: {
  workspaces: Workspace[];
  currentId: string | null;
  onChoose: (id: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const create = useCreateWorkspace();
  const name = search.trim();
  const taken = workspaces.some((w) => w.name.toLowerCase() === name.toLowerCase());

  return (
    <Command>
      <CommandInput placeholder="Find or create a workspace…" value={search} onValueChange={setSearch} />
      <CommandList className="max-h-[280px]">
        <CommandGroup>
          <CommandItem value="none" keywords={["No workspace"]} onSelect={() => onChoose(null)} className="gap-2">
            <Check on={currentId === null} />
            No workspace
          </CommandItem>
          {workspaces.map((w) => (
            <CommandItem key={w.id} value={w.id} keywords={[w.name]} onSelect={() => onChoose(w.id)} className="gap-2">
              <Check on={currentId === w.id} />
              <span className="truncate">{w.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {name && !taken && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="create"
                keywords={[name]}
                disabled={create.isPending}
                onSelect={() => create.mutate(name, { onSuccess: (w) => onChoose(w.id) })}
                className="gap-2"
              >
                <FolderPlusIcon className="size-4" />
                <span className="truncate">Create “{name}”</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}

function Check({ on }: { on: boolean }) {
  return <CheckIcon className={cn("size-4 shrink-0", on ? "opacity-100" : "opacity-0")} />;
}
