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
import {
  type SessionHandle,
  useMarkViewed,
  useSessions,
} from "@/lib/api/sessions";
import { useDeleteThread, useThreads } from "@/lib/api/threads";
import { groupThreads, threadTitle } from "@/lib/group-threads";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import {
  CircleAlertIcon,
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
import { useEffect, useMemo, useRef, useState } from "react";

export function AppSidebar() {
  const { data: threads = [], isLoading } = useThreads();
  const { data: sessions = [] } = useSessions();
  const groups = groupThreads(threads);
  const params = useParams();
  const activeId = params?.threadId as string | undefined;
  const requestNewChat = useUiStore((s) => s.requestNewChat);

  // Join the thread list to the session list by session_id === thread.id. Build
  // the lookup ONCE per sessions change (not a find() per row) so the status
  // pulse / completed-ring indicators don't turn the ~5s sessions poll into a
  // per-row re-render storm.
  const sessionByThread = useMemo(() => {
    const map = new Map<string, SessionHandle>();
    for (const s of sessions) map.set(s.session_id, s);
    return map;
  }, [sessions]);

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
                      session={sessionByThread.get(t.id)}
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

/** A session is "active" (still holding the backend open) while queued/running/
 *  awaiting-input; terminal once done/error/cancelled. */
function isActiveStatus(status: SessionHandle["status"]): boolean {
  return (
    status === "running" ||
    status === "awaiting-input" ||
    status === "queued"
  );
}

/** Pulsing emerald status dot (ping ring + solid core) for a running/queued
 *  session on a thread row. */
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

/** Static hollow "completed" ring for a terminal thread. Blue = an unread
 *  result waiting; gray = the session is still within the retention window but
 *  the user has already seen it. Reads as "there's a result" rather than "still
 *  working" (that's the pulse). */
function CompletedRing({ viewed }: { viewed: boolean }) {
  return (
    <span
      aria-label={viewed ? "Viewed" : "Unread response"}
      className={cn(
        "size-2.5 shrink-0 rounded-full border-2",
        viewed ? "border-muted-foreground/50" : "border-blue-500",
      )}
    />
  );
}

function ThreadRow({
  id,
  title,
  active,
  session,
}: {
  id: string;
  title: string;
  active: boolean;
  session?: SessionHandle;
}) {
  const router = useRouter();
  const del = useDeleteThread();
  const markViewed = useMarkViewed();

  // A joined session is either active (pulse) or terminal. Terminal sessions
  // still present in useSessions() (i.e. within the retention window) show a
  // ring: blue if the user hasn't opened it yet, gray once viewed.
  const activeSession = session && isActiveStatus(session.status);
  const terminal = session && !activeSession;
  const unviewed = Boolean(terminal && !session.viewed);

  // Mark viewed the moment the user opens a finished-but-unviewed thread. Firing
  // on `active && unviewed` covers both navigating into /chat/{id} and the
  // active thread changing; the mutation invalidates ["sessions"] so the ring
  // clears immediately. There's a brief window between the POST and the sessions
  // cache refetch where `unviewed` is still true — a `viewedRef` latch (reset
  // whenever this row goes inactive) keeps us from re-POSTing during it.
  const shouldMarkViewed = Boolean(active && unviewed);
  const mutate = markViewed.mutate;
  const viewedRef = useRef(false);
  useEffect(() => {
    // Reset the latch whenever the row goes inactive so a later re-open re-marks
    // (e.g. a NEW terminal run on the same thread the user opens again).
    if (!active) {
      viewedRef.current = false;
      return;
    }
    if (shouldMarkViewed && !viewedRef.current) {
      viewedRef.current = true;
      mutate(id);
    }
  }, [active, shouldMarkViewed, id, mutate]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className="h-9">
        <Link href={`/chat/${id}`}>
          <span className="truncate">{title}</span>
        </Link>
      </SidebarMenuButton>
      {/* Single status icon per row, absolutely positioned in the SAME slot as
          the hover-trash (right-1). Fades out on row hover so the trash cleanly
          replaces it with zero shift. Priority: running/queued (green pulse) >
          awaiting-input (exclamation) > terminal unread (blue ring) > terminal
          viewed (gray ring) > none. */}
      {session && (
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 transition-opacity group-hover/menu-item:opacity-0">
          {session.status === "awaiting-input" ? (
            <CircleAlertIcon
              aria-label="Awaiting your input"
              className="size-3.5 text-amber-500"
            />
          ) : activeSession ? (
            <StatusDot />
          ) : (
            <CompletedRing viewed={!unviewed} />
          )}
        </span>
      )}
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
