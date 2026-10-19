"use client";

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Workspace } from "@/lib/api/types";
import { useCreateWorkspace } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { CheckIcon, FolderPlusIcon } from "lucide-react";
import { useState } from "react";

import { WorkspaceAvatar } from "./workspace-avatar";

/** The workspaces to choose from, plus "No workspace", and a create item for a
 *  name typed that no workspace has. */
export function WorkspaceCommand({
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
              <WorkspaceAvatar workspace={w} size="sm" />
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
