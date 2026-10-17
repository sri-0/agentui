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
import type { RunStatus } from "@/lib/api/types";
import { groupThreads, threadTitle } from "@/lib/group-threads";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import {
  BookOpenIcon,
  CircleAlertIcon,
  ImageIcon,
  LayersIcon,
  MoonIcon,
  PenSquareIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

export function AppSidebar() {
  const { data: threads = [], isLoading } = useThreads();
  const groups = groupThreads(threads);
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

function ThreadRow({
  id,
  title,
  active,
  runStatus,
}: {
  id: string;
  title: string;
  active: boolean;
  /** present while a run owns the thread */
  runStatus?: RunStatus;
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
