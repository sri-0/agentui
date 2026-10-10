import { create } from "zustand";

import { ApiError } from "@/lib/api/client";
import { cancelRun as cancelOverRest, decideInterrupt, fetchMessages, fetchThread, startRun } from "@/lib/api/threads";
import { useUiStore } from "@/stores/ui-store";

import { emptyThread, reduce, type ThreadState } from "./reduce";
import { chatSocket, type ServerFrame } from "./socket";

/**
 * Thread state for every open thread. Incoming events are folded as they
 * arrive but published to React at most once per animation frame, so a burst
 * of tokens costs one render.
 */
type ChatStore = {
  threads: Record<string, ThreadState>;
  connected: boolean;
};

export const useChatStore = create<ChatStore>(() => ({ threads: {}, connected: true }));

const pending = new Map<string, ThreadState>();
let frame = 0;

function current(threadId: string): ThreadState {
  return pending.get(threadId) ?? useChatStore.getState().threads[threadId] ?? emptyThread;
}

function stage(threadId: string, next: ThreadState) {
  pending.set(threadId, next);
  if (!frame) frame = requestAnimationFrame(publish);
}

function publish() {
  frame = 0;
  const threads = { ...useChatStore.getState().threads };
  for (const [id, t] of pending) threads[id] = t;
  pending.clear();
  useChatStore.setState({ threads });
}

chatSocket.onFrame = (f: ServerFrame) => {
  const t = current(f.threadId);
  switch (f.type) {
    case "event":
      stage(f.threadId, { ...reduce(t, f.event), cursor: f.seq });
      break;
    case "idle":
      if (t.status === "streaming") stage(f.threadId, { ...t, status: "idle" });
      break;
    case "error":
      stage(f.threadId, { ...t, status: "error", error: f.message });
      break;
  }
};
chatSocket.onConnected = (connected) => useChatStore.setState({ connected });

/** Per-thread open generation: a newer openThread supersedes one in flight. */
const opens = new Map<string, number>();

/** Load a thread's history, fold it, follow its live run if there is one,
 *  and show the connectors the thread remembers. */
export async function openThread(threadId: string) {
  const gen = (opens.get(threadId) ?? 0) + 1;
  opens.set(threadId, gen);
  let t: ThreadState;
  try {
    const [{ data, cursor }, thread] = await Promise.all([fetchMessages(threadId), fetchThread(threadId)]);
    t = { ...emptyThread, cursor };
    for (const m of data) for (const ev of m.events) t = reduce(t, ev);
    useUiStore.getState().setConnectors(thread.connectors ?? null);
  } catch (err) {
    t = { ...emptyThread, status: "error", error: (err as Error).message };
  }
  if (opens.get(threadId) !== gen) return;
  // A thread with no history has no run to follow yet.
  if (t.messages.length > 0 || t.cursor) {
    chatSocket.send({ type: "subscribe", threadId, after: t.cursor });
  }
  stage(threadId, { ...t, loaded: true });
  publish();
}

export function closeThread(threadId: string) {
  chatSocket.send({ type: "unsubscribe", threadId });
}

/** Start a thread with its first message; the server names the thread.
 *  The caller opens it, which replays the turn from its start. */
export function startThread(text: string, opts: { agentId?: string; model?: string; connectors?: string[] | null }) {
  return startRun({
    messages: [{ id: crypto.randomUUID(), role: "user", content: text }],
    agent_id: opts.agentId,
    model: opts.model,
    connectors: opts.connectors,
  });
}

/** Queue a turn over REST and follow it on the socket. */
export async function sendMessage(
  threadId: string,
  text: string,
  opts: { agentId?: string; model?: string; connectors?: string[] | null },
) {
  const id = crypto.randomUUID();
  const t = current(threadId);
  stage(threadId, {
    ...t,
    status: "streaming",
    error: undefined,
    messages: [...t.messages, { id, role: "user", parts: [{ type: "text", id, text, done: true }] }],
  });
  await follow(threadId, () =>
    startRun({
      thread_id: threadId,
      messages: [{ id, role: "user", content: text }],
      agent_id: opts.agentId,
      model: opts.model,
      connectors: opts.connectors,
    }),
  );
}

/** Answer the paused run's interrupt; the continuation streams on the same turn. */
export async function resumeRun(threadId: string, interruptId: string, decision: object) {
  stage(threadId, { ...current(threadId), status: "streaming", interrupts: [] });
  await follow(threadId, () => decideInterrupt(threadId, interruptId, decision));
}

export async function cancelRun(threadId: string) {
  try {
    await cancelOverRest(threadId);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err; // already over
  }
}

/** Start or continue a run and subscribe from its cursor; a refusal lands as the thread's error. */
async function follow(threadId: string, start: () => Promise<{ cursor: string }>) {
  try {
    const { cursor } = await start();
    chatSocket.send({ type: "subscribe", threadId, after: cursor });
  } catch (err) {
    stage(threadId, { ...current(threadId), status: "error", error: (err as Error).message });
  }
}
