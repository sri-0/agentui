"use client";

import { getUserId } from "@/lib/api/client";
import { useSessionStatus, useSessions } from "@/lib/api/sessions";
import { sessionStreamUrl } from "@/lib/chat/api";
import { sseToChunkStream } from "@/lib/chat/sse-to-chunks";
import type { ChatMessage } from "@/lib/chat/types";
import { useQueryClient } from "@tanstack/react-query";
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
 * Hybrid rebuild: finished turns are seeded from persisted history (fromHistory
 * in ThreadView), and this hook attaches at `after = start_seq - 1` — the
 * session handle's first sequence for the in-progress run — so the backend
 * replays exactly the current turn's events, not the whole session log. The
 * backend stamps the deterministic `{session}:{turn}:assistant` message id on
 * the replayed start frame, so the upsert below is a true idempotent replace
 * against both the live-streamed and the reloaded rendering of the same turn.
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
  // Fire on mount: force the sessions list fresh NOW so a thread whose run
  // started moments ago (e.g. navigate-away-and-back mid-stream) is detected
  // immediately instead of waiting for useSessions' 5s poll to converge — the
  // delay that left a returning thread blank until the next poll tick.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!threadId) return;
    void queryClient.refetchQueries({ queryKey: ["sessions"] });
  }, [threadId, queryClient]);
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

  // Replay only the in-progress run: its first event-log seq is start_seq, so
  // `after = start_seq - 1` skips every already-persisted turn (those are
  // seeded from history). Falls back to a full replay (after=0) if the handle
  // predates the field — harmless, since the deterministic message ids make the
  // replay an idempotent replace.
  const startSeq = session?.start_seq;

  useEffect(() => {
    if (!isLive || primaryBusy || primaryOwnedRef.current || attachedRef.current)
      return;
    attachedRef.current = true;
    const controller = new AbortController();
    setReconnecting(true);

    (async () => {
      try {
        const after = Math.max(0, (startSeq ?? 1) - 1);
        const res = await fetch(sessionStreamUrl(threadId, after), {
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
  }, [threadId, isLive, primaryBusy, setMessages, startSeq]);

  return { reconnecting };
}
