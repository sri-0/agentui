"use client";

import { getUserId } from "@/lib/api/client";
import { useSessionStatus, useSessions } from "@/lib/api/sessions";
import { sessionStreamUrl } from "@/lib/chat/api";
import { sseToChunkStream } from "@/lib/chat/sse-to-chunks";
import type { ChatMessage } from "@/lib/chat/types";
import type { ChatStatus } from "ai";
import { readUIMessageStream } from "ai";
import { useEffect, useRef, useState } from "react";

type SetMessages = (
  arg: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
) => void;

/**
 * Rejoin a still-running server-side session (Phase 01). Runs execute in the
 * background decoupled from the connection, so when a thread view loads (or the
 * client dropped mid-run) and the backend reports the session as
 * `running`/`awaiting-input`, we attach to `GET /v1/sessions/{id}/stream` and
 * merge the replay-then-live AI-SDK stream into the chat by upserting messages
 * on `id` — the same merge shape used by the HITL resume.
 *
 * Seq tradeoff: the AI-SDK UI message stream doesn't surface a per-part `seq` to
 * the client, so we can't compute a precise high-water mark here. We reconnect
 * with `after=0` (full replay-then-live); keyed-replacement makes the replay
 * idempotent (same-id parts overwrite), so re-rendering already-seen messages is
 * harmless. Upgrade to a real high-water `after=<seq>` once the stream exposes
 * sequence numbers per part.
 *
 * Only attaches when the client is NOT already streaming this thread (so we
 * never double up on the primary transport), and once per session id. Crucially,
 * "not already streaming" is latched across the whole mount: if the primary
 * transport ever drove this thread (send / mid-stream / interrupt) this client
 * owns the run, so we skip reconnect even in the brief windows where `status`
 * drops back to `ready` (at an interrupt, or right after a turn completes) while
 * the session is still listed as `running`/`awaiting-input`.
 */
export function useSessionReconnect(
  threadId: string,
  status: ChatStatus,
  setMessages: SetMessages,
): { reconnecting: boolean } {
  // The user's live-session list (already polled for the sidebar) is the source
  // of truth for "which threads have an ACTIVE run". Gate the per-thread status
  // probe on it: a settled/persisted thread is absent from this list, so we skip
  // `GET /v1/sessions/{id}` entirely and avoid the browser logging a 404 on
  // every reload. Only threads that are genuinely active still get probed —
  // reconnect behaviour for running sessions is unchanged.
  const { data: sessions = [] } = useSessions();
  const maybeLive =
    Boolean(threadId) &&
    sessions.some(
      (s) =>
        s.session_id === threadId &&
        (s.status === "running" ||
          s.status === "awaiting-input" ||
          s.status === "queued"),
    );
  const { data: session } = useSessionStatus(threadId, maybeLive);
  const [reconnecting, setReconnecting] = useState(false);
  const attachedRef = useRef(false);

  const isLive =
    session?.status === "running" || session?.status === "awaiting-input";
  // The primary chat transport is authoritative for this thread while it's
  // sending/receiving — don't attach a second reader over the top of it.
  const primaryBusy = status === "streaming" || status === "submitted";

  // Once the primary `useChat` transport has driven this thread at all in this
  // mount (sent a message, hit an interrupt, or is mid-stream), THIS client owns
  // the run's stream. Reconnect must never attach then: the run appears in the
  // live `/v1/sessions` list as `running`/`awaiting-input` (so `isLive` is true)
  // and, at an interrupt or right after a turn completes, the primary stream's
  // HTTP response has ended so `status` drops back to `ready` (so `primaryBusy`
  // is momentarily false) — the exact window that let a SECOND stream attach,
  // duplicating the assistant bubble / question card and racing the interrupt
  // resolver. Latch it so reconnect only ever runs for a genuine reload/drop
  // where the primary transport never handled this thread.
  const primaryOwnedRef = useRef(false);
  if (primaryBusy) primaryOwnedRef.current = true;

  useEffect(() => {
    if (!isLive || primaryBusy || primaryOwnedRef.current || attachedRef.current)
      return;
    attachedRef.current = true;
    const controller = new AbortController();
    setReconnecting(true);

    (async () => {
      try {
        const res = await fetch(sessionStreamUrl(threadId, 0), {
          headers: {
            Accept: "text/event-stream",
            "X-User-ID": getUserId(),
          },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        for await (const msg of readUIMessageStream<ChatMessage>({
          stream: sseToChunkStream(res.body),
        })) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx === -1) return [...prev, msg];
            const copy = prev.slice();
            copy[idx] = msg;
            return copy;
          });
        }
      } catch {
        /* aborted or network drop — leave what we merged so far */
      } finally {
        setReconnecting(false);
      }
    })();

    return () => controller.abort();
  }, [threadId, isLive, primaryBusy, setMessages]);

  return { reconnecting };
}
