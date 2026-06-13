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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteThread, useThreads } from "@/lib/api/threads";
import { groupThreads, threadTitle } from "@/lib/group-threads";
import { useUiStore } from "@/stores/ui-store";
import {
  MoonIcon,
  PenSquareIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AppSidebar() {
  const { data: threads = [], isLoading } = useThreads();
  const groups = groupThreads(threads);
  const params = useParams();
  const activeId = params?.threadId as string | undefined;
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
          {!isLoading && groups.length === 0 && (
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

function ThreadRow({
  id,
  title,
  active,
}: {
  id: string;
  title: string;
  active: boolean;
}) {
  const router = useRouter();
  const del = useDeleteThread();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className="h-9">
        <Link href={`/chat/${id}`}>
          <span className="truncate">{title}</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuAction
        showOnHover
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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
