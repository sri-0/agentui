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
} from "@/components/ui/sidebar";
import { useDeleteThread, useThreads } from "@/lib/api/threads";
import { groupThreads, threadTitle } from "@/lib/group-threads";
import { cn } from "@/lib/utils";
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
  const { data: threads = [] } = useThreads();
  const groups = groupThreads(threads);
  const params = useParams();
  const activeId = params?.threadId as string | undefined;
  const requestNewChat = useUiStore((s) => s.requestNewChat);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-4 px-3 py-4">
        <Link
          href="/chat"
          className="flex items-center gap-2.5 overflow-hidden px-1 font-semibold tracking-tight group-data-[collapsible=icon]:px-0"
        >
          <SparklesIcon className="size-5 shrink-0 text-primary" />
          <span className="truncate text-[15px] group-data-[collapsible=icon]:hidden">
            Agent Console
          </span>
        </Link>

        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="New chat" className="h-10">
              <Link href="/chat" onClick={() => requestNewChat()}>
                <PenSquareIcon className="size-4" />
                <span>New chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search chats"
              className="h-10 cursor-default"
            >
              <SearchIcon className="size-4" />
              <span>Search chats</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-1 py-2 group-data-[collapsible=icon]:hidden">
        {groups.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            No conversations yet.
          </p>
        )}
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="px-2 py-0">
            <SidebarGroupLabel className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
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
      </SidebarContent>

      <SidebarFooter className="p-3">
        <ThemeToggle />
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
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={dark ? "Light mode" : "Dark mode"}
          onClick={() => setTheme(dark ? "light" : "dark")}
          className={cn("h-10 text-muted-foreground")}
        >
          {dark ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
          <span>{dark ? "Light mode" : "Dark mode"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
