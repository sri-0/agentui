"use client";

import { LibraryItem, LibraryItems, LibraryPage, LibraryToolbar } from "@/components/library/library";
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
import { useFiles } from "@/lib/api/files";
import { useThreads } from "@/lib/api/threads";
import type { Thread, Workspace } from "@/lib/api/types";
import { useCreateWorkspace, useDeleteWorkspace, useRenameWorkspace, useWorkspaces } from "@/lib/api/workspaces";
import dayjs from "@/lib/dayjs";
import { threadTitle } from "@/lib/group-threads";
import { FolderPlusIcon, MessageSquareIcon, MoreHorizontalIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { WorkspaceAvatar } from "./workspace-avatar";

/**
 * The workspaces as cards (or rows), as ChatGPT's Spaces shows its items:
 * each with its latest chats and how many chats and files it holds. A card
 * opens the workspace's page (WorkspaceView); New workspace makes one.
 */
export function WorkspacesView() {
  const { data: workspaces = [], isPending, error } = useWorkspaces();
  const { data: threads = [] } = useThreads();
  const { data: files = [] } = useFiles();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const create = useCreateWorkspace();

  const q = search.trim().toLowerCase();
  const shown = workspaces.filter((w) => !q || w.name.toLowerCase().includes(q));

  return (
    <LibraryPage title="Workspaces">
      <LibraryToolbar
        heading="Workspaces"
        search={search}
        onSearch={setSearch}
        placeholder="Search workspaces"
        actions={
          <Button onClick={() => setCreating(true)}>
            <FolderPlusIcon /> New workspace
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isPending && !error && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {workspaces.length
            ? "Nothing matches."
            : "No workspaces yet. A workspace keeps related chats together, with their artifacts, sources and files."}
        </p>
      )}
      <LibraryItems>
        {shown.map((w) => (
          <WorkspaceItem
            key={w.id}
            workspace={w}
            threads={threads.filter((t) => t.workspace_id === w.id)}
            files={files.filter((f) => f.workspace_id === w.id).length}
          />
        ))}
      </LibraryItems>
      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New workspace"
        onSave={(name) => create.mutateAsync(name)}
      />
    </LibraryPage>
  );
}

/** One workspace's card: its latest chats, its counts and its last activity. */
function WorkspaceItem({ workspace, threads, files }: { workspace: Workspace; threads: Thread[]; files: number }) {
  const last = threads[0]?.updated_at ?? workspace.updated_at; // threads come newest first
  return (
    <LibraryItem
      href={`/workspaces/${workspace.id}`}
      preview={<ChatsPreview threads={threads} />}
      icon={<WorkspaceAvatar workspace={workspace} />}
      title={workspace.name}
      subtitle={`${count(threads.length, "chat")} · ${count(files, "file")}`}
      meta={last ? `Updated ${dayjs(last).fromNow()}` : undefined}
      actions={<WorkspaceMenu workspace={workspace} className="shadow-xs" variant="secondary" />}
    />
  );
}

/** A card's preview: its latest chats' titles, as on a small page. */
function ChatsPreview({ threads }: { threads: Thread[] }) {
  if (!threads.length) return <span className="m-auto text-xs text-muted-foreground">No chats yet</span>;
  return (
    <span className="flex w-full justify-center overflow-hidden px-5 pt-6">
      <span className="flex w-full flex-col gap-2.5 overflow-hidden rounded-t-md border border-b-0 bg-background px-3 pt-3 shadow-sm">
        {threads.slice(0, 4).map((t) => (
          <span key={t.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquareIcon className="size-3 shrink-0" />
            <span className="truncate">{threadTitle(t)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** A workspace's "…" menu: rename it, or delete it (its chats and files stay,
 *  in no workspace); onDeleted follows a delete. */
export function WorkspaceMenu({
  workspace,
  onDeleted,
  variant = "ghost",
  className,
}: {
  workspace: Workspace;
  onDeleted?: () => void;
  variant?: "ghost" | "secondary";
  className?: string;
}) {
  const [renaming, setRenaming] = useState(false);
  const rename = useRenameWorkspace();
  const remove = useDeleteWorkspace();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size="icon-sm" aria-label={`More for ${workspace.name}`} className={className}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => remove.mutate(workspace.id, { onSuccess: onDeleted })}
          >
            Delete (keeps its chats and files)
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
