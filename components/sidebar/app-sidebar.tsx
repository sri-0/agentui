"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreads } from "@/lib/api/threads";
import type { Thread } from "@/lib/api/types";
import { useWorkspaces } from "@/lib/api/workspaces";
import { groupThreads, threadTitle } from "@/lib/group-threads";
import { useUiStore } from "@/stores/ui-store";
import {
  BookOpenIcon,
  ImageIcon,
  LayersIcon,
  MoonIcon,
  PenSquareIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { ThreadRow } from "./thread-row";
import { WorkspaceGroups } from "./workspace-groups";

export function AppSidebar() {
  const threadsQuery = useThreads();
  const workspacesQuery = useWorkspaces();
  const isLoading = threadsQuery.isLoading || workspacesQuery.isLoading;
  const threads = threadsQuery.data ?? [];
  const workspaces = workspacesQuery.data ?? [];
  // A conversation filed under a workspace shows in it; the rest (and any
  // whose workspace is gone) are grouped by date.
  const known = new Set(workspaces.map((w) => w.id));
  const isFiled = (t: Thread) => known.has(t.workspace_id ?? "");
  const filed = threads.filter(isFiled);
  const groups = groupThreads(threads.filter((t) => !isFiled(t)));
  const params = useParams();
  const activeId = params?.threadId as string | undefined;
  const pathname = usePathname();
  const requestNewChat = useUiStore((s) => s.requestNewChat);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="gap-2.5">
              <Link href="/chat" onClick={() => requestNewChat()}>
                <div className="ai-gradient flex aspect-square size-8 items-center justify-center rounded-lg text-white shadow-sm">
                  <SparklesIcon className="size-[18px]" />
                </div>
                <span className="truncate text-[15px] font-semibold">
                  AgentUI
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-2">
        <SidebarGroup className="px-0 py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="New chat"
                  className="h-9 gap-2.5"
                >
                  <Link href="/chat" onClick={() => requestNewChat()}>
                    <PenSquareIcon />
                    <span>New chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Search chats" className="h-9 gap-2.5">
                  <SearchIcon />
                  <span>Search chats</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Artifacts" isActive={pathname === "/artifacts"} className="h-9 gap-2.5">
                  <Link href="/artifacts">
                    <LayersIcon />
                    <span>Artifacts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Images" isActive={pathname.startsWith("/images")} className="h-9 gap-2.5">
                  <Link href="/images">
                    <ImageIcon />
                    <span>Images</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Skills" isActive={pathname.startsWith("/skills")} className="h-9 gap-2.5">
                  <Link href="/skills">
                    <BookOpenIcon />
                    <span>Skills</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-0 my-1 group-data-[collapsible=icon]:hidden" />

        <div className="group-data-[collapsible=icon]:hidden">
          {isLoading && (
            <SidebarGroup className="px-0">
              <SidebarGroupLabel>
                <Skeleton className="h-2.5 w-14 rounded" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {/* fixed widths → SSR-safe (no Math.random) */}
                  {[70, 88, 58, 80, 64, 90, 52].map((w, i) => (
                    <SidebarMenuItem key={i}>
                      <div className="flex h-9 items-center px-2">
                        <Skeleton
                          className="h-3.5 rounded"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          {!isLoading && <WorkspaceGroups workspaces={workspaces} threads={filed} activeId={activeId} />}
          {!isLoading && groups.length === 0 && filed.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No conversations yet.
            </p>
          )}
          {!isLoading &&
            groups.map((group) => (
            <SidebarGroup key={group.label} className="px-0">
              <SidebarGroupLabel className="px-2 text-xs font-semibold text-sidebar-foreground/65">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.threads.map((t) => (
                    <ThreadRow
                      key={t.id}
                      id={t.id}
                      title={threadTitle(t)}
                      active={t.id === activeId}
                      runStatus={t.run_status}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <ThemeToggle />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The theme is only known on the client; render the light variant on the
  // server so hydration matches.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && theme === "dark";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={dark ? "Light mode" : "Dark mode"}
        onClick={() => setTheme(dark ? "light" : "dark")}
        className="h-9 gap-2.5 text-muted-foreground"
      >
        {dark ? <SunIcon /> : <MoonIcon />}
        <span>{dark ? "Light mode" : "Dark mode"}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
