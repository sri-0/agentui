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

        <RunningSessions activeId={activeId} />

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

/** Live "Running" section: sessions the backend still holds open (queued /
 *  running / awaiting-input) plus recently finished ones, so the user can leave
 *  and rejoin a running swarm. Degrades to nothing if /v1/sessions is empty or
 *  errors (the hook try/catches to []). */
function RunningSessions({ activeId }: { activeId?: string }) {
  const { data: sessions = [] } = useSessions();
  // Surface the interesting ones first; hide fully-idle noise when there's
  // nothing live to show.
  const live = sessions.filter(
    (s) =>
      s.status === "running" ||
      s.status === "awaiting-input" ||
      s.status === "queued",
  );
  if (live.length === 0) return null;

  return (
    <SidebarGroup className="px-0 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="px-2 text-xs font-semibold text-sidebar-foreground/65">
        Running
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {live.map((s) => (
            <SessionRow
              key={s.session_id}
              session={s}
              active={s.session_id === activeId}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

const STATUS_STYLE: Record<
  SessionHandle["status"],
  { label: string; dot: string; pulse: boolean }
> = {
  queued: { label: "Queued", dot: "bg-amber-500", pulse: true },
  running: { label: "Running", dot: "bg-emerald-500", pulse: true },
  "awaiting-input": { label: "Needs input", dot: "bg-blue-500", pulse: true },
  done: { label: "Done", dot: "bg-muted-foreground/40", pulse: false },
  error: { label: "Error", dot: "bg-destructive", pulse: false },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground/40", pulse: false },
};

/** A session is "active" (still holding the backend open) while queued/running/
 *  awaiting-input; terminal once done/error/cancelled. */
function isActiveStatus(status: SessionHandle["status"]): boolean {
  return (
    status === "running" ||
    status === "awaiting-input" ||
    status === "queued"
  );
}

/** Pulsing status dot (ping ring + solid core), reused by the Running section
 *  rows and the active-session indicator on the main thread rows. */
function StatusDot({ status }: { status: SessionHandle["status"] }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.running;
  return (
    <span className="relative flex size-2 shrink-0 items-center justify-center">
      {s.pulse && (
        <span
          className={cn(
            "absolute inline-flex size-2 animate-ping rounded-full opacity-75",
            s.dot,
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", s.dot)} />
    </span>
  );
}

/** Static "completed" ring for a finished-but-unviewed thread — a hollow ring
 *  (NOT the pulse) so it reads as "there's a result waiting" rather than "still
 *  working". Disappears once the session is marked viewed. */
function CompletedRing() {
  return (
    <span
      aria-label="Completed"
      className="size-2 shrink-0 rounded-full border-[1.5px] border-emerald-500"
    />
  );
}

function SessionRow({
  session,
  active,
}: {
  session: SessionHandle;
  active: boolean;
}) {
  const s = STATUS_STYLE[session.status] ?? STATUS_STYLE.running;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={s.label}
        className="h-9"
      >
        {/* session_id is the thread id — clicking rejoins that thread (which
            reconnects to the live stream, see useSessionReconnect). */}
        <Link href={`/chat/${session.session_id}`}>
          <StatusDot status={session.status} />
          <span className="truncate">{session.agent_id || session.session_id}</span>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {s.label}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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

  // A joined session is either active (pulse) or terminal. The completed ring
  // only shows for a terminal run the user hasn't opened yet.
  const activeSession = session && isActiveStatus(session.status);
  const unviewed = session && !activeSession && !session.viewed;

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
          {activeSession && (
            <span className="ml-auto mr-0.5">
              <StatusDot status={session.status} />
            </span>
          )}
          {unviewed && (
            <span className="ml-auto mr-0.5">
              <CompletedRing />
            </span>
          )}
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
