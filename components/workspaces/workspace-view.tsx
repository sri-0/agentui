"use client";

import { ArtifactItem } from "@/components/artifacts/artifacts-view";
import { UploadDialog } from "@/components/files/upload-dialog";
import { FileItem } from "@/components/files/files-view";
import { LibraryItem, LibraryItems, LibraryPage, LibraryToolbar } from "@/components/library/library";
import { SourceList } from "@/components/sources/source-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRecentArtifacts } from "@/lib/api/artifacts";
import { useFileNames, useFiles } from "@/lib/api/files";
import { useThreads } from "@/lib/api/threads";
import { useWorkspaces } from "@/lib/api/workspaces";
import dayjs from "@/lib/dayjs";
import { threadTitle } from "@/lib/group-threads";
import { useUiStore } from "@/stores/ui-store";
import {
  ArrowLeftIcon,
  BookMarkedIcon,
  FilesIcon,
  LayersIcon,
  MessageSquareIcon,
  PenSquareIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { WorkspaceAvatar } from "./workspace-avatar";
import { WorkspaceMenu } from "./workspaces-view";

const TABS = ["chats", "artifacts", "sources", "files"] as const;
type Tab = (typeof TABS)[number];

/**
 * One workspace's page: what is filed under it, in tabs (?tab=, so Back
 * returns to the one left): its chats, the artifacts they made, the sources
 * they used and its files. The search box searches the tab shown.
 */
export function WorkspaceView({ id }: { id: string }) {
  const { data: workspaces, isPending, error } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === id);
  const param = useSearchParams().get("tab");
  const tab: Tab = TABS.find((t) => t === param) ?? "chats";
  const pathname = usePathname();
  const router = useRouter();
  const requestNewChat = useUiStore((s) => s.requestNewChat);
  const [search, setSearch] = useState("");

  const back = (
    <Button variant="ghost" size="sm" asChild className="-mb-2 self-start">
      <Link href="/workspaces">
        <ArrowLeftIcon /> Workspaces
      </Link>
    </Button>
  );
  if (!workspace) {
    return (
      <LibraryPage title="Workspaces">
        {back}
        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{isPending ? "Loading…" : "This workspace no longer exists."}</p>
        )}
      </LibraryPage>
    );
  }

  return (
    <LibraryPage title="Workspaces">
      {back}
      <LibraryToolbar
        heading={
          <>
            <WorkspaceAvatar workspace={workspace} />
            <span className="truncate">{workspace.name}</span>
          </>
        }
        search={search}
        onSearch={setSearch}
        placeholder={`Search ${tab}`}
        actions={
          <>
            <Button asChild>
              <Link href="/chat" onClick={() => requestNewChat(id)}>
                <PenSquareIcon /> New chat
              </Link>
            </Button>
            <WorkspaceMenu workspace={workspace} onDeleted={() => router.push("/workspaces")} />
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })}
        className="gap-6"
      >
        <TabsList>
          <TabsTrigger value="chats">
            <MessageSquareIcon /> Chats
          </TabsTrigger>
          <TabsTrigger value="artifacts">
            <LayersIcon /> Artifacts
          </TabsTrigger>
          <TabsTrigger value="sources">
            <BookMarkedIcon /> Sources
          </TabsTrigger>
          <TabsTrigger value="files">
            <FilesIcon /> Files
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chats" className="flex flex-col gap-6">
          <ChatList workspaceId={id} search={search} />
        </TabsContent>
        <TabsContent value="artifacts" className="flex flex-col gap-6">
          <ArtifactList workspaceId={id} search={search} />
        </TabsContent>
        <TabsContent value="sources" className="flex flex-col gap-6">
          <SourceList workspaceId={id} search={search} />
        </TabsContent>
        <TabsContent value="files" className="flex flex-col gap-6">
          <FileList workspaceId={id} search={search} />
        </TabsContent>
      </Tabs>
    </LibraryPage>
  );
}

/** The workspace's chats, newest first, archived ones too (the sidebar leaves
 *  those out). */
function ChatList({ workspaceId, search }: { workspaceId: string; search: string }) {
  const { data: threads = [], isPending } = useThreads();
  const named = useFileNames(); // a title holds the #ids the message named
  const q = search.trim().toLowerCase();
  const chats = threads.filter((t) => t.workspace_id === workspaceId);
  const shown = chats.filter((t) => !q || named(threadTitle(t)).toLowerCase().includes(q));
  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!shown.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {chats.length ? "Nothing matches." : "No chats yet. Start one with New chat, or move one here from its menu."}
      </p>
    );
  }
  return (
    <LibraryItems>
      {shown.map((t) => (
        <LibraryItem
          key={t.id}
          href={`/chat/${t.id}`}
          icon={
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
              <MessageSquareIcon className="size-4 text-muted-foreground" />
            </span>
          }
          title={named(threadTitle(t))}
          subtitle={t.archived ? "Archived" : undefined}
          meta={t.updated_at ? dayjs(t.updated_at).fromNow() : undefined}
        />
      ))}
    </LibraryItems>
  );
}

/** The artifacts the workspace's chats made, newest first; each opens on the
 *  artifacts page. */
function ArtifactList({ workspaceId, search }: { workspaceId: string; search: string }) {
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useRecentArtifacts(
    undefined,
    workspaceId,
  );
  const artifacts = data?.pages.flatMap((p) => p.data) ?? [];
  const q = search.trim().toLowerCase();
  const shown = artifacts.filter(
    (a) => !q || a.title.toLowerCase().includes(q) || a.thread_title?.toLowerCase().includes(q),
  );
  return (
    <>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isPending && !error && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {artifacts.length ? "Nothing matches." : "No artifacts yet. Ask an agent for a report, a document or a deck."}
        </p>
      )}
      <LibraryItems>
        {shown.map((a) => {
          const key = `${a.root_id}/${a.id}`;
          return <ArtifactItem key={key} artifact={a} href={`/artifacts?open=${encodeURIComponent(key)}`} />;
        })}
      </LibraryItems>
      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </>
  );
}

/** The workspace's files, newest first, and Upload, into the workspace. */
function FileList({ workspaceId, search }: { workspaceId: string; search: string }) {
  const { data: files = [], error, isPending } = useFiles(workspaceId);
  const [uploading, setUploading] = useState(false);
  const q = search.trim().toLowerCase();
  const shown = files.filter(
    (f) => !q || f.name.toLowerCase().includes(q) || f.tags?.some((t) => t.toLowerCase().includes(q)),
  );
  return (
    <>
      <Button variant="outline" size="sm" className="self-start" onClick={() => setUploading(true)}>
        <UploadIcon /> Upload
      </Button>
      {uploading && <UploadDialog workspaceId={workspaceId} onClose={() => setUploading(false)} />}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isPending && !error && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {files.length ? "Nothing matches." : "No files yet. Chats in the workspace can name its files with #."}
        </p>
      )}
      <LibraryItems>
        {shown.map((f) => (
          <FileItem key={f.id} file={f} />
        ))}
      </LibraryItems>
    </>
  );
}
