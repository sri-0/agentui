"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import type { Thread, Workspace } from "@/lib/api/types";
import { useCreateWorkspace, useDeleteWorkspace, useRenameWorkspace } from "@/lib/api/workspaces";
import { threadTitle } from "@/lib/group-threads";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PenSquareIcon,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { ThreadRow } from "./thread-row";

/** The sidebar's workspaces, each a folder of its conversations. */
export function WorkspaceGroups({
  workspaces,
  threads,
  activeId,
}: {
  workspaces: Workspace[];
  /** the conversations filed under one of the workspaces, newest first */
  threads: Thread[];
  activeId?: string;
}) {
  const [creating, setCreating] = useState(false);
  const create = useCreateWorkspace();

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupLabel className="px-2 text-xs font-semibold text-sidebar-foreground/65">Workspaces</SidebarGroupLabel>
      <SidebarGroupAction title="New workspace" onClick={() => setCreating(true)}>
        <FolderPlusIcon />
        <span className="sr-only">New workspace</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {workspaces.map((w) => (
            <WorkspaceItem
              key={w.id}
              workspace={w}
              threads={threads.filter((t) => t.workspace_id === w.id)}
              activeId={activeId}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New workspace"
        onSave={(name) => create.mutateAsync(name)}
      />
    </SidebarGroup>
  );
}

function WorkspaceItem({ workspace, threads, activeId }: { workspace: Workspace; threads: Thread[]; activeId?: string }) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const rename = useRenameWorkspace();
  const remove = useDeleteWorkspace();
  const requestNewChat = useUiStore((s) => s.requestNewChat);

  // The folder and its chats are sibling rows, not nested ones: a row's hover
  // styles (the trash, the status dot) follow the nearest menu item.
  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton className="h-9 gap-2 pr-14" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronRightIcon className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
          <FolderIcon className="size-4 shrink-0" />
          <span className="truncate">{workspace.name}</span>
        </SidebarMenuButton>
        <SidebarMenuAction showOnHover asChild className="right-7" title={`New chat in ${workspace.name}`}>
          <Link href="/chat" onClick={() => requestNewChat(workspace.id)}>
            <PenSquareIcon className="size-3.5" />
            <span className="sr-only">New chat in {workspace.name}</span>
          </Link>
        </SidebarMenuAction>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover>
              <MoreHorizontalIcon className="size-3.5" />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(workspace.id)}>
              Delete (keeps its chats)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <NameDialog
          open={renaming}
          onOpenChange={setRenaming}
          title="Rename workspace"
          initial={workspace.name}
          onSave={(name) => rename.mutateAsync({ id: workspace.id, name })}
        />
      </SidebarMenuItem>
      {open && (
        <li>
          <SidebarMenuSub className="mr-0 gap-0.5 pr-0">
            {threads.map((t) => (
              <ThreadRow
                key={t.id}
                id={t.id}
                title={threadTitle(t)}
                active={t.id === activeId}
                runStatus={t.run_status}
              />
            ))}
            {threads.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No chats yet</p>}
          </SidebarMenuSub>
        </li>
      )}
    </>
  );
}

/** Asks for a workspace's name; closes once onSave resolves. */
function NameDialog({
  open,
  onOpenChange,
  title,
  initial = "",
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: string;
  onSave: (name: string) => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        {/* Mounted per opening, so each starts from the current name. */}
        <NameForm title={title} initial={initial} onSave={onSave} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  title,
  initial,
  onSave,
  onDone,
}: {
  title: string;
  initial: string;
  onSave: (name: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSave(name.trim());
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={!name.trim()}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
