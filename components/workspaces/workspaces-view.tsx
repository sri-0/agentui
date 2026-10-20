"use client";

import { VisibilityBadge, VisibilityField } from "@/components/common/visibility";
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
import { useCreateWorkspace, useDeleteWorkspace, useUpdateWorkspace, useWorkspaces } from "@/lib/api/workspaces";
import dayjs from "@/lib/dayjs";
import { threadTitle } from "@/lib/group-threads";
import { FolderPlusIcon, LockIcon, MessageSquareIcon, MoreHorizontalIcon, UsersIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { WorkspaceAvatar } from "./workspace-avatar";

/**
 * The workspaces as cards (or rows), as ChatGPT's Spaces shows its items:
 * the user's own and the public ones, each with its latest chats and how
 * many chats and files it holds. A card opens the workspace's page
 * (WorkspaceView); New workspace makes one, public unless it says otherwise.
 */
export function WorkspacesView() {
  const { data: workspaces = [], isPending, error } = useWorkspaces();
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
                    <WorkspaceItem key={w.id} workspace={w} files={files.filter((f) => f.workspace_id === w.id).length} />
        ))}
      </LibraryItems>
      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New workspace"
        visibility
        onSave={(name, shared) => create.mutateAsync({ name, isShared: shared })}
      />
    </LibraryPage>
  );
}

/** One workspace's card: its latest chats (the user's own and the public
 *  ones), its counts and its last activity. */
function WorkspaceItem({ workspace, files }: { workspace: Workspace; files: number }) {
  const { data: threads = [] } = useThreads(workspace.id);
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
    >
      <VisibilityBadge shared={workspace.is_shared} mine={workspace.mine} by={workspace.user_created_by} />
    </LibraryItem>
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

/** A workspace's "…" menu, for its creator: rename it, make it public or
 *  keep it to themselves, or delete it (its chats and files stay, in no
 *  workspace); onDeleted follows a delete. Anyone else gets none. */
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
  const update = useUpdateWorkspace();
  const remove = useDeleteWorkspace();
  if (!workspace.mine) return null;
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
            disabled={update.isPending}
            onSelect={() => update.mutate({ id: workspace.id, isShared: !workspace.is_shared })}
          >
            {workspace.is_shared ? (
              <>
                <LockIcon /> Only me
              </>
            ) : (
              <>
                <UsersIcon /> Make public
              </>
            )}
          </DropdownMenuItem>
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
        onSave={(name) => update.mutateAsync({ id: workspace.id, name })}
      />
    </>
  );
}

/** Asks for a workspace's name, and, with visibility, who can see it (public
 *  to start); closes once onSave resolves. */
function NameDialog({
  open,
  onOpenChange,
  title,
  initial = "",
  visibility,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: string;
  visibility?: boolean;
  onSave: (name: string, shared: boolean) => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        {/* Mounted per opening, so each starts from the current name. */}
        <NameForm title={title} initial={initial} visibility={visibility} onSave={onSave} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  title,
  initial,
  visibility,
  onSave,
  onDone,
}: {
  title: string;
  initial: string;
  visibility?: boolean;
  onSave: (name: string, shared: boolean) => Promise<unknown>;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial);
  const [shared, setShared] = useState(true);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSave(name.trim(), shared);
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
      {visibility && <VisibilityField value={shared} onChange={setShared} />}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={!name.trim()}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
