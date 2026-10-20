"use client";

import {
  LibraryItem,
  LibraryItems,
  LibraryPage,
  LibraryToolbar,
  NavItem,
  NavSection,
} from "@/components/library/library";
import { VisibilityBadge } from "@/components/common/visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceAvatar } from "@/components/workspaces/workspace-avatar";
import { fileContentUrl, type UserFile, useDeleteFile, useFiles, useUpdateFile } from "@/lib/api/files";
import { useWorkspaces } from "@/lib/api/workspaces";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  DownloadIcon,
  FilesIcon,
  InboxIcon,
  LockIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type DragEvent, useState } from "react";

import { FileKindIcon, formatSize } from "./file-icon";
import { UploadDialog } from "./upload-dialog";

/** /files with the filters given, the empty ones left out. */
const filesHref = (filter: { workspace?: string; visibility?: string }) => {
  const params = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
  return params.size ? `/files?${params}` : "/files";
};

/**
 * The files the user can see, their own and the shared ones, newest first,
 * as cards (or rows): all of them, the unfiled ones, or one workspace's
 * (?workspace=<id>|none), and, with ?visibility=mine|public, only those kept
 * to the user or only the public ones; search matches names and tags. Upload
 * (the button, or a drop anywhere on the list) opens the upload dialog for
 * the workspace shown, or none. A file is downloaded, never opened in the
 * browser.
 */
export function FilesView() {
  const params = useSearchParams();
  const param = params.get("workspace");
  const workspaceId = param === null ? undefined : param === "none" ? null : param; // undefined: all
  const visibility = params.get("visibility") ?? undefined;
  const { data: workspaces = [] } = useWorkspaces();
  const { data: files = [], error, isPending } = useFiles(workspaceId);
  const { data: all } = useFiles(); // the total
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<File[]>(); // the dialog is open, with these to start
  const [dragging, setDragging] = useState(false);

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const q = search.trim().toLowerCase();
    const shown = files.filter(
    (f) =>
      (!q || f.name.toLowerCase().includes(q) || f.tags?.some((t) => t.toLowerCase().includes(q))) &&
      (visibility === "mine" ? !f.is_shared : visibility === "public" ? f.is_shared : true),
  );
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) setUploading(Array.from(e.dataTransfer.files));
  };

  const nav = (
    <>
            <NavItem
        icon={<FilesIcon className="text-muted-foreground" />}
        label="All files"
        count={all?.length}
        active={workspaceId === undefined}
        href={filesHref({ visibility })}
      />
      <NavSection label="Workspaces">
        <NavItem
          icon={<InboxIcon className="text-muted-foreground" />}
          label="No workspace"
          active={workspaceId === null}
          href={filesHref({ workspace: "none", visibility })}
        />
        {workspaces.map((w) => (
          <NavItem
            key={w.id}
            icon={<WorkspaceAvatar workspace={w} size="sm" />}
            label={w.name}
            active={workspaceId === w.id}
            href={filesHref({ workspace: w.id, visibility })}
          />
        ))}
      </NavSection>
      {/* Choosing the chosen one again shows every file. */}
      <NavSection label="Visibility">
        <NavItem
          icon={<LockIcon className="text-muted-foreground" />}
          label="Only me"
          count={all?.filter((f) => !f.is_shared).length}
          active={visibility === "mine"}
          href={filesHref({ workspace: param ?? undefined, visibility: visibility === "mine" ? undefined : "mine" })}
        />
        <NavItem
          icon={<UsersIcon className="text-muted-foreground" />}
          label="Public"
          count={all?.filter((f) => f.is_shared).length}
          active={visibility === "public"}
          href={filesHref({ workspace: param ?? undefined, visibility: visibility === "public" ? undefined : "public" })}
        />
      </NavSection>
    </>
  );

  return (
    <LibraryPage title="Files" nav={nav}>
      <LibraryToolbar
        heading={workspace?.name ?? (workspaceId === null ? "No workspace" : "All files")}
        search={search}
        onSearch={setSearch}
        placeholder="Search files"
        actions={
          <Button
            onClick={() => setUploading([])}
            title={`Upload into ${workspace ? `the workspace ${workspace.name}` : "no workspace"}`}
          >
            <UploadIcon /> Upload
          </Button>
        }
      />
      {uploading && (
        <UploadDialog workspaceId={workspaceId ?? null} initialFiles={uploading} onClose={() => setUploading(undefined)} />
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
        onDrop={drop}
        className={cn(
          "relative -m-2 flex min-h-64 flex-col gap-6 rounded-2xl p-2 transition-colors",
          dragging && "bg-accent/40 outline-2 outline-dashed outline-primary/40",
        )}
      >
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isPending && !error && shown.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <UploadIcon className="size-5" />
            {files.length
              ? "No file matches."
              : "No files yet. Drop documents, images, audio or video here, or upload them; then name one in a chat with #."}
          </div>
        )}
        <LibraryItems>
          {shown.map((f) => (
            <FileItem key={f.id} file={f} />
          ))}
        </LibraryItems>
      </div>
    </LibraryPage>
  );
}

/** One file: an image shows itself, anything else its icon; the first badge
 *  says whether search_userfiles finds it, then who sees it when that is
 *  worth saying, the rest are its tags. Its uploader's menu shares it or
 *  keeps it to them, and deletes it; anyone else only downloads it. */
export function FileItem({ file }: { file: UserFile }) {
  const del = useDeleteFile();
  const update = useUpdateFile();
  return (
    <LibraryItem
      preview={
        file.media_type.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by the API, any size
          <img src={fileContentUrl(file.id)} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <FileKindIcon mediaType={file.media_type} className="size-8" />
          </span>
        )
      }
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
          <FileKindIcon mediaType={file.media_type} className="size-4" />
        </span>
      }
      title={file.name}
      subtitle={`${formatSize(file.size)} · ${file.media_type.split(";")[0]}`}
      meta={`Uploaded ${dayjs(file.created_at).fromNow()}`}
      actions={
        <>
          {/* The server sends it as a download (Content-Disposition), so it never opens in a tab. */}
          <Button asChild variant="secondary" size="icon-sm" className="shadow-xs">
            <a href={fileContentUrl(file.id)} download={file.name} aria-label={`Download ${file.name}`} title="Download">
              <DownloadIcon />
            </a>
          </Button>
                    {file.mine && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon-sm" aria-label={`More for ${file.name}`} className="shadow-xs">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={update.isPending}
                  onSelect={() => update.mutate({ id: file.id, isShared: !file.is_shared })}
                >
                  {file.is_shared ? (
                    <>
                      <LockIcon /> Only me
                    </>
                  ) : (
                    <>
                      <UsersIcon /> Make public
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={del.isPending}
                  onSelect={() => confirm(`Delete ${file.name}? Chats can no longer use it.`) && del.mutate(file.id)}
                >
                  <Trash2Icon /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      }
    >
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" title={STATUS[file.status].hint}>
          {STATUS[file.status].label}
        </Badge>
        <VisibilityBadge shared={file.is_shared} mine={file.mine} by={file.user_created_by} />
        {file.tags?.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
    </LibraryItem>
  );
}

const STATUS: Record<UserFile["status"], { label: string; hint: string }> = {
  ready: { label: "Searchable", hint: "Embedded: chats in its workspace find it with search_userfiles" },
  stored: { label: "Reference only", hint: "Not embedded: name it with # to give it to the model" },
};
