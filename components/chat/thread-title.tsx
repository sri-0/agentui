"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WorkspaceAvatar } from "@/components/workspaces/workspace-avatar";
import { WorkspaceCommand } from "@/components/workspaces/workspace-command";
import { useFileNames } from "@/lib/api/files";
import { useThreadRecord } from "@/lib/api/threads";
import { useUpdateThread, useWorkspaces } from "@/lib/api/workspaces";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { threadTitle } from "@/lib/group-threads";
import { cn } from "@/lib/utils";
import { useContext, useRef, useState } from "react";

/** A part of the title that changes on a click: a background on hover. */
const EDITABLE =
  "flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground";

/**
 * The conversation's place, in the thread header (shadcn Breadcrumb): its
 * workspace, then its title. A click on the workspace picks another (the
 * composer bar's list); a click on the title edits it in place.
 */
export function ThreadTitle() {
  const threadId = useContext(ThreadIdContext) ?? "";
  const { data: thread } = useThreadRecord(threadId);
  const { data: workspaces = [] } = useWorkspaces();
  const named = useFileNames(); // a title holds the #ids the message named
  const update = useUpdateThread();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!thread) return null;
  const workspace = workspaces.find((w) => w.id === thread.workspace_id);

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1 sm:gap-1">
        {workspace && (
          <>
            <BreadcrumbItem className="shrink-0">
              <Popover open={picking} onOpenChange={setPicking}>
                <PopoverTrigger asChild>
                  <button type="button" title="Move to another workspace" className={EDITABLE}>
                    <WorkspaceAvatar workspace={workspace} size="sm" />
                    <span className="max-w-48 truncate">{workspace.name}</span>
                  </button>
                </PopoverTrigger>
                {picking && (
                  <PopoverContent align="start" className="w-[260px] p-0">
                    <WorkspaceCommand
                      workspaces={workspaces}
                      currentId={workspace.id}
                      onChoose={(id) => {
                        setPicking(false);
                        if (id !== workspace.id) update.mutate({ threadId, workspaceId: id });
                      }}
                    />
                  </PopoverContent>
                )}
              </Popover>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
          </>
        )}
        <BreadcrumbItem className="min-w-0">
          {editing ? (
            <TitleInput
              initial={thread.title ?? ""}
              onDone={(title) => {
                setEditing(false);
                if (title && title !== thread.title) update.mutate({ threadId, title });
              }}
            />
          ) : (
            <button
              type="button"
              title="Rename"
              onClick={() => setEditing(true)}
              className={cn(EDITABLE, "min-w-0 text-foreground")}
            >
              <span className="truncate">{named(threadTitle(thread))}</span>
            </button>
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** The title being edited: Enter or leaving it saves, Escape keeps the old
 *  one (onDone gets nothing). */
function TitleInput({ initial, onDone }: { initial: string; onDone: (title?: string) => void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false); // ended by Enter or Escape; the blur that follows does nothing
  const finish = (title?: string) => {
    if (done.current) return;
    done.current = true;
    onDone(title);
  };
  return (
    <Input
      autoFocus
      value={value}
      maxLength={200}
      aria-label="Conversation title"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(value.trim());
        if (e.key === "Escape") finish();
      }}
      onBlur={() => finish(value.trim())}
      className="h-7 w-[min(36rem,50vw)] px-1.5"
    />
  );
}
