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

type Parts = ChatMessage["parts"];

/** A tool result whose `tool-input-*` frames predate the tail attach point —
 *  held out of the tail stream and applied onto the folded base part instead. */
type OrphanOutput = { output?: unknown; errorText?: string };

/**
 * Splice the live TAIL of an in-progress turn onto its folded base. `base` is
 * the turn as the history fetch delivered it (folded up to the reported
 * head_seq); `tail` is the same deterministic message id rebuilt from ONLY the
 * events after that seq. Rules:
 *
 * - In-place data parts with stable ids ("tasks", "usage", artifact ids,
 *   `agent-step` ids) re-emitted in the tail supersede their base copy — drop
 *   the base one so e.g. the task board doesn't render twice. Same for a
 *   dynamic-tool part re-surfaced in the tail (e.g. a HITL resume).
 * - A tool RESULT arriving in the tail for a call made before the attach point
 *   (an "orphan output") is applied onto the base's folded tool part.
 * - A text/reasoning part split across the fold/tail boundary is coalesced so
 *   the answer doesn't render as two markdown blocks mid-sentence.
 */
function mergeTailParts(
  base: Parts,
  tail: Parts,
  orphanOutputs: Map<string, OrphanOutput>,
): Parts {
  if (tail.length === 0 && orphanOutputs.size === 0) return base;

  const superseded = new Set<string>();
  const supersededTools = new Set<string>();
  for (const p of tail) {
    const id = (p as { id?: unknown }).id;
    if (typeof id === "string" && p.type.startsWith("data-")) {
      superseded.add(`${p.type}:${id}`);
    }
    if (p.type === "dynamic-tool") supersededTools.add(p.toolCallId);
  }
  let kept =
    superseded.size || supersededTools.size
      ? base.filter((p) => {
          if (p.type === "dynamic-tool" && supersededTools.has(p.toolCallId))
            return false;
          const id = (p as { id?: unknown }).id;
          return !(typeof id === "string" && superseded.has(`${p.type}:${id}`));
        })
      : base.slice();

  if (orphanOutputs.size) {
    kept = kept.map((p) => {
      if (p.type !== "dynamic-tool") return p;
      const res = orphanOutputs.get(p.toolCallId);
      if (!res) return p;
      return res.errorText != null
        ? { ...p, state: "output-error", errorText: res.errorText }
        : { ...p, state: "output-available", output: res.output };
    }) as Parts;
  }

  let rest = tail;
  const last = kept[kept.length - 1];
  const first = rest[0];
  if (
    last &&
    first &&
    last.type === first.type &&
    (last.type === "text" || last.type === "reasoning")
  ) {
    kept[kept.length - 1] = {
      ...last,
      text:
        ((last as { text?: string }).text ?? "") +
        ((first as { text?: string }).text ?? ""),
    } as Parts[number];
    rest = rest.slice(1);
  }
  return [...kept, ...rest];
}

/**
 * Rejoin a still-running server-side session (Phase 01). Runs execute in the
 * background decoupled from the connection, so when a thread view loads (or the
 * client dropped mid-run) and the backend reports the session as
 * `running`/`awaiting-input`, we attach to `GET /v1/sessions/{id}/stream` and
 * merge the live stream into the chat by upserting messages on their
 * deterministic ids — the same merge shape used by the HITL resume.
 *
 * TAIL-ONLY attach: the thread history fetch is session-aware — while a run is
 * active, `GET /v1/threads/{id}/messages` already returns the in-progress
 * assistant turn FULLY FOLDED (projected server-side from the event log) plus
 * the head seq it folded up to (`liveHeadSeq`, threaded in by ThreadView from
 * the same snapshot that seeded `initialMessages`). So the thread paints
 * instantly from the fetch, and this hook attaches the live stream at
 * `after = liveHeadSeq`: only NEW events stream in, spliced onto the folded
 * base via mergeTailParts. No full-run delta replay on the client. When the
 * fetch reported no live head (e.g. the run started between fetch and attach),
 * we fall back to replaying the current turn from `start_seq - 1` — the
 * deterministic message ids make that an idempotent replace.
 *
 * Merges are THROTTLED (~50ms, matching the primary transport's
 * `experimental_throttle`) so a burst of tail chunks batches into a few
 * setMessages calls instead of one per chunk.
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
  liveHeadSeq?: number,
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

  // Captured ONCE at mount: the Chat instance seeds initialMessages exactly once
  // (from the same history snapshot this head seq came with), so attaching at
  // the captured value keeps fetch + tail gap-free by construction even if a
  // later background refetch reports a newer head.
  const headSeqRef = useRef(liveHeadSeq);

  // Fallback when the history fetch carried no live head: replay only the
  // in-progress run — its first event-log seq is start_seq, so
  // `after = start_seq - 1` skips every already-persisted turn.
  const startSeq = session?.start_seq;

  useEffect(() => {
    if (!isLive || primaryBusy || primaryOwnedRef.current || attachedRef.current)
      return;
    attachedRef.current = true;
    const controller = new AbortController();
    setReconnecting(true);
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const headSeq = headSeqRef.current;
        const tailOnly = headSeq != null;
        const after = tailOnly ? headSeq : Math.max(0, (startSeq ?? 1) - 1);
        const res = await fetch(sessionStreamUrl(threadId, after), {
          headers: {
            Accept: "text/event-stream",
            "X-User-ID": getUserId(),
          },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        // In tail mode the stream re-opens the SAME deterministic message id but
        // carries only the events after headSeq — so remember each id's folded
        // base parts (as fetched) and splice the growing tail onto them.
        //
        // A tail can also carry a tool RESULT whose `tool-input-*` frames came
        // before the attach point. The AI-SDK message reader treats such an
        // orphan `tool-output-available` as a hard error and silently ENDS the
        // stream (dropping everything after it, including the final answer), so
        // hold those chunks out of the stream and apply them onto the folded
        // base tool part in the merge instead.
        const baseParts = new Map<string, Parts>();
        const orphanOutputs = new Map<string, OrphanOutput>();
        const seenToolInputs = new Set<string>();
        let chunks = sseToChunkStream(res.body);
        if (tailOnly) {
          chunks = chunks.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                const c = chunk as {
                  type?: string;
                  toolCallId?: string;
                  output?: unknown;
                  errorText?: string;
                };
                if (
                  (c.type === "tool-input-start" ||
                    c.type === "tool-input-available") &&
                  c.toolCallId
                ) {
                  seenToolInputs.add(c.toolCallId);
                } else if (
                  (c.type === "tool-output-available" ||
                    c.type === "tool-output-error") &&
                  c.toolCallId &&
                  !seenToolInputs.has(c.toolCallId)
                ) {
                  orphanOutputs.set(c.toolCallId, {
                    output: c.output,
                    errorText: c.errorText,
                  });
                  return;
                }
                controller.enqueue(chunk);
              },
            }),
          );
        }
        let pending: ChatMessage | null = null;
        const flush = () => {
          timer = null;
          const msg = pending;
          if (!msg) return;
          pending = null;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx === -1) return [...prev, msg];
            const copy = prev.slice();
            if (tailOnly) {
              let base = baseParts.get(msg.id);
              if (!base) {
                base = prev[idx].parts;
                baseParts.set(msg.id, base);
              }
              copy[idx] = {
                ...msg,
                parts: mergeTailParts(base, msg.parts, orphanOutputs),
              };
            } else {
              copy[idx] = msg;
            }
            return copy;
          });
        };

        for await (const msg of readUIMessageStream<ChatMessage>({
          stream: chunks,
        })) {
          pending = msg;
          if (timer == null) timer = setTimeout(flush, 50);
        }
        if (timer != null) clearTimeout(timer);
        flush(); // final state, applied unconditionally
      } catch {
        /* aborted or network drop — leave what we merged so far */
      } finally {
        if (timer != null) clearTimeout(timer);
        setReconnecting(false);
      }
    })();

    return () => controller.abort();
  }, [threadId, isLive, primaryBusy, setMessages, startSeq]);

  return { reconnecting };
}
