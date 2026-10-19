"use client";

import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useFileNames } from "@/lib/api/files";
import { useDeleteThread } from "@/lib/api/threads";
import type { RunStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { WorkspaceAvatar } from "@/components/workspaces/workspace-avatar";
import type { Workspace } from "@/lib/api/types";
import { CircleAlertIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Pulsing emerald status dot (ping ring + solid core) for a thread whose run
 *  is queued or running. */
function StatusDot() {
  return (
    <span
      aria-label="Running"
      className="relative flex size-2 shrink-0 items-center justify-center"
    >
      <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-500 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  );
}

export function ThreadRow({
  id,
  title,
  active,
  runStatus,
  workspace,
}: {
  id: string;
  title: string;
  active: boolean;
  /** present while a run owns the thread */
  runStatus?: RunStatus;
  /** the workspace it is filed under, shown under the title */
  workspace?: Workspace;
}) {
  const router = useRouter();
  const del = useDeleteThread();
  const named = useFileNames(); // a title holds the #ids the message named

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className={cn("h-9", workspace && "h-auto flex-col items-start gap-0.5 py-1.5")}>
        <Link href={`/chat/${id}`}>
          <span className="w-full truncate">{named(title)}</span>
          {workspace && (
            <span className="flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
              <WorkspaceAvatar workspace={workspace} size="xs" />
              <span className="truncate">{workspace.name}</span>
            </span>
          )}
        </Link>
      </SidebarMenuButton>
      {/* The status and the trash share the slot at the row's end. Hovering the
          row slides the status out and the trash in, and tabbing to the trash
          shows it too. (shadcn's showOnHover shows it whenever the row has
          focus, so after a click, on top of the status.) Below md the sidebar
          is a sheet with no hover: the trash stays and the status sits beside it. */}
      {runStatus && (
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 transition duration-200 ease-out max-md:right-7 motion-reduce:transition-none",
            "group-hover/menu-item:translate-x-2 group-hover/menu-item:opacity-0",
            "group-has-[[data-sidebar=menu-action]:focus-visible]/menu-item:opacity-0",
          )}
        >
          {runStatus === "awaiting_input" ? (
            <CircleAlertIcon
              aria-label="Awaiting your input"
              className="size-3.5 text-amber-500"
            />
          ) : (
            <StatusDot />
          )}
        </span>
      )}
      <SidebarMenuAction
        className={cn(
          "translate-x-2 opacity-0 transition duration-200 ease-out motion-reduce:transition-none",
          "group-hover/menu-item:translate-x-0 group-hover/menu-item:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100",
          "peer-data-active/menu-button:text-sidebar-accent-foreground max-md:translate-x-0 max-md:opacity-100",
        )}
        onClick={() =>
          del.mutate(id, { onSuccess: () => active && router.push("/chat") })
        }
      >
        <Trash2Icon className="size-3.5" />
        <span className="sr-only">Delete</span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}
