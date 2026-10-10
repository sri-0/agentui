"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useChatStore } from "@/lib/chat/store";

import { apiFetch } from "./client";
import type { ListResponse, RunStart, StoredMessage, Thread } from "./types";

/**
 * The thread list. It is fetched once, refetched when a run this client
 * watches starts or ends (status, order change), and when the window regains
 * focus. There is no polling. TanStack dedupes the query across callers.
 */
export function useThreads() {
  const qc = useQueryClient();
  useEffect(
    () =>
      useChatStore.subscribe((s, prev) => {
        if (s.threads === prev.threads) return;
        for (const id in s.threads) {
          const before = prev.threads[id];
          if (before && before.status !== s.threads[id].status) {
            void qc.invalidateQueries({ queryKey: ["threads"] });
            return;
          }
        }
      }),
    [qc],
  );
  return useQuery({
    queryKey: ["threads"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiFetch<ListResponse<Thread>>("/v1/threads");
      return res.data;
    },
  });
}

/** A thread's stored turns, oldest first, plus the log cursor to subscribe
 *  from ("" when no run is active). */
export function fetchMessages(threadId: string) {
  return apiFetch<ListResponse<StoredMessage> & { cursor: string }>(
    `/v1/threads/${encodeURIComponent(threadId)}/messages`,
  );
}

export function fetchThread(threadId: string) {
  return apiFetch<Thread>(`/v1/threads/${encodeURIComponent(threadId)}`);
}

/** Queue a turn; the run streams on the socket from the returned cursor.
 *  Without thread_id the server creates the thread and names it on the run. */
export function startRun(body: {
  thread_id?: string;
  messages: { id: string; role: "user"; content: string }[];
  agent_id?: string;
  model?: string;
  connectors?: string[] | null;
}) {
  return apiFetch<RunStart>("/v1/agent/chat", { method: "POST", body: JSON.stringify(body) });
}

/** Answer a paused run's interrupt: `{approved, justification}` or `{output}`. */
export function decideInterrupt(threadId: string, interruptId: string, decision: object) {
  return apiFetch<RunStart>(
    `/v1/threads/${encodeURIComponent(threadId)}/interrupts/${encodeURIComponent(interruptId)}`,
    { method: "POST", body: JSON.stringify(decision) },
  );
}

export function cancelRun(threadId: string) {
  return apiFetch<void>(`/v1/threads/${encodeURIComponent(threadId)}/cancel`, { method: "POST" });
}

export function useDeleteThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/threads/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });
}
