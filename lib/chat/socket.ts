import type { Event as AgUiEvent } from "@ag-ui/core";

import { API_URL } from "@/lib/api/client";

/**
 * One WebSocket per browser tab, shared by every thread the UI shows, to the
 * backend's agent chat endpoint. All traffic with agents on existing threads
 * goes over it; a new thread is created over HTTP first (`createThread`).
 * Requests (run, answer, cancel) are answered by an `ack` or `error` frame
 * carrying their requestId. Thread subscriptions are multiplexed over the
 * same socket; each thread remembers the last log cursor it saw so a
 * reconnect resumes it without a gap. The server lets the socket in to a
 * thread on its first frame about it, and refuses one the user cannot read.
 */

/** An answer to an interrupt: an approval, or a question's answers. */
export type Decision = { approved?: boolean; justification?: string; output?: unknown };

/** A request frame, before the socket gives it a requestId. */
export type Request =
  | {
      type: "run";
      threadId: string;
      model?: string;
      agentId?: string;
      connectors?: string[] | null;
      messages: { id: string; role: "user"; content: string }[];
    }
  | ({ type: "answer"; threadId: string; interruptId: string } & Decision)
  | { type: "cancel"; threadId: string };

type Follow = { type: "subscribe"; threadId: string; after?: string } | { type: "unsubscribe"; threadId: string };

/** A request's acknowledgement: the thread (created by a run without one),
 *  the run, and the cursor to follow it from. */
export type Ack = { type: "ack"; requestId: string; threadId: string; runId?: string; seq?: string };

/** A frame about a followed thread. */
export type ThreadFrame =
  | { type: "event"; threadId: string; seq: string; event: AgUiEvent }
  | { type: "idle"; threadId: string }
  | { type: "error"; threadId: string; code: string; message: string };

/** A refused request. */
type RequestError = { type: "error"; requestId: string; threadId?: string; code: string; message: string };

type ServerFrame = Ack | RequestError | ThreadFrame;

/** A refused request; `code` is the server's (busy, not_paused, not_found, bad_request, internal). */
export class SocketError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const SOCKET_URL = `${API_URL.replace(/^http/, "ws")}/v1/agent/chat?v=1`;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;

class ChatSocket {
  private ws: WebSocket | null = null;
  private attempts = 0;
  /** Open subscriptions: thread id → last seq delivered. */
  private subs = new Map<string, string>();
  /** Requests waiting for their ack; `sent` once on the wire. */
  private pending = new Map<string, { resolve: (a: Ack) => void; reject: (e: Error) => void; sent: boolean }>();
  /** Requests waiting for the socket to open, in order. */
  private outbox: { id: string; raw: string }[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  /** Frames of followed threads; acks go to their requests instead. */
  onFrame: (frame: ThreadFrame) => void = () => {};
  onConnected: (connected: boolean) => void = () => {};

  /** Follow or stop following a thread. */
  send(frame: Follow) {
    if (typeof window === "undefined") return;
    if (frame.type === "subscribe") this.subs.set(frame.threadId, frame.after ?? "");
    else this.subs.delete(frame.threadId);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
    else this.open(); // on open every entry in subs is subscribed
  }

  /** Send a request and wait for its ack. */
  request(frame: Request): Promise<Ack> {
    const requestId = crypto.randomUUID();
    const raw = JSON.stringify({ ...frame, requestId });
    return new Promise((resolve, reject) => {
      const open = this.ws?.readyState === WebSocket.OPEN;
      this.pending.set(requestId, { resolve, reject, sent: open });
      if (open) this.ws!.send(raw);
      else {
        this.outbox.push({ id: requestId, raw });
        this.open();
      }
    });
  }

  private open() {
    if (this.ws) return;
    const ws = new WebSocket(SOCKET_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.onConnected(true);
      // Every followed thread resumes from the last cursor it received.
      for (const [threadId, after] of this.subs) ws.send(JSON.stringify({ type: "subscribe", threadId, after }));
      for (const { id, raw } of this.outbox.splice(0)) {
        const p = this.pending.get(id);
        if (p) p.sent = true;
        ws.send(raw);
      }
    };
    ws.onmessage = (m) => {
      const frame = JSON.parse(m.data) as ServerFrame;
      if ("requestId" in frame) {
        const p = this.pending.get(frame.requestId);
        this.pending.delete(frame.requestId);
        if (frame.type === "ack") p?.resolve(frame);
        else p?.reject(new SocketError(frame.code, frame.message));
        return;
      }
      if (!this.subs.has(frame.threadId)) return; // still in flight after an unsubscribe
      if (frame.type === "event") this.subs.set(frame.threadId, frame.seq);
      if (frame.type === "error" && frame.code === "not_found") this.subs.delete(frame.threadId); // refused: not resubscribed
      this.onFrame(frame);
    };
    ws.onclose = () => {
      this.ws = null;
      this.onConnected(false);
      // A sent request's outcome is unknown; the thread's history will tell.
      // Requests not yet sent stay queued for the reconnect.
      for (const [id, p] of this.pending) {
        if (!p.sent) continue;
        p.reject(new SocketError("internal", "connection lost"));
        this.pending.delete(id);
      }
      if (this.subs.size > 0 || this.outbox.length > 0) this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.attempts) * (0.5 + Math.random());
    this.attempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.open();
    }, delay);
  }
}

// Kept on globalThis so a dev hot reload of this module reuses the socket
// instead of opening another one.
const g = globalThis as { __agentliteSocket?: ChatSocket };
export const chatSocket = (g.__agentliteSocket ??= new ChatSocket());
