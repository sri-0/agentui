"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { WorkspaceAvatar } from "@/components/workspaces/workspace-avatar";
import { useFileNames } from "@/lib/api/files";
import { useThreadRecord } from "@/lib/api/threads";
import { useWorkspaces } from "@/lib/api/workspaces";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { threadTitle } from "@/lib/group-threads";
import Link from "next/link";
import { useContext } from "react";

/** The conversation's place, in the thread header (shadcn Breadcrumb): its
 *  workspace, a link to the workspace's page, then its title. */
export function ThreadTitle() {
  const threadId = useContext(ThreadIdContext) ?? "";
  const { data: thread } = useThreadRecord(threadId);
  const { data: workspaces } = useWorkspaces();
  const named = useFileNames(); // a title holds the #ids the message named
  if (!thread) return null;
  const workspace = workspaces?.find((w) => w.id === thread.workspace_id);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {workspace && (
          <>
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink asChild>
                <Link href={`/workspaces/${workspace.id}`} className="flex items-center gap-2">
                  <WorkspaceAvatar workspace={workspace} size="sm" />
                  <span className="max-w-48 truncate">{workspace.name}</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
          </>
        )}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{named(threadTitle(thread))}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
