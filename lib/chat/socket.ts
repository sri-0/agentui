import type { Event as AgUiEvent } from "@ag-ui/core";

import { API_URL } from "@/lib/api/client";

/**
 * One WebSocket per browser tab to the backend's agent chat endpoint. Thread
 * subscriptions are multiplexed over it; each thread remembers the last log
 * cursor it saw so a reconnect resumes every open thread without a gap.
 */

export type ClientFrame =
  | { type: "subscribe"; threadId: string; after?: string }
  | { type: "unsubscribe"; threadId: string };

export type ServerFrame =
  | { type: "event"; threadId: string; seq: string; event: AgUiEvent }
  | { type: "idle"; threadId: string }
  | { type: "error"; threadId: string; code: string; message: string };

const SOCKET_URL = `${API_URL.replace(/^http/, "ws")}/v1/agent/chat?v=1`;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;

class ChatSocket {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private queue: string[] = [];
  /** Open subscriptions: thread id → last seq delivered. */
  private subs = new Map<string, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  onFrame: (frame: ServerFrame) => void = () => {};
  onConnected: (connected: boolean) => void = () => {};

  send(frame: ClientFrame) {
    if (typeof window === "undefined") return;
    if (frame.type === "subscribe") this.subs.set(frame.threadId, frame.after ?? "");
    else this.subs.delete(frame.threadId);
    const raw = JSON.stringify(frame);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(raw);
    else {
      this.queue.push(raw);
      this.open();
    }
  }

  private open() {
    if (this.ws) return;
    const ws = new WebSocket(SOCKET_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.onConnected(true);
      // Frames queued while offline go first; every other open thread then
      // resumes from the last cursor it received.
      const queued = this.queue;
      this.queue = [];
      const covered = new Set(queued.map((raw) => (JSON.parse(raw) as ClientFrame).threadId));
      for (const raw of queued) ws.send(raw);
      for (const [threadId, after] of this.subs) {
        if (!covered.has(threadId)) ws.send(JSON.stringify({ type: "subscribe", threadId, after }));
      }
    };
    ws.onmessage = (m) => {
      const frame = JSON.parse(m.data) as ServerFrame;
      if (frame.type === "event" && this.subs.has(frame.threadId)) this.subs.set(frame.threadId, frame.seq);
      this.onFrame(frame);
    };
    ws.onclose = () => {
      this.ws = null;
      this.onConnected(false);
      if (this.subs.size > 0 || this.queue.length > 0) this.scheduleReconnect();
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
