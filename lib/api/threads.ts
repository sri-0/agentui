"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useChatStore } from "@/lib/chat/store";

import { apiFetch } from "./client";
import type { ListResponse, StoredMessage, Thread } from "./types";

/**
 * The thread list: the user's own conversations (the sidebar's), or, given a
 * workspace, the conversations filed under it that the user can see, their
 * own and the public ones. It is fetched once, refetched when a run this
 * client watches starts or ends (status, order change), and when the window
 * regains focus. There is no polling. TanStack dedupes the query across
 * callers.
 */
export function useThreads(workspaceId?: string) {
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
    queryKey: workspaceId ? ["threads", "workspace", workspaceId] : ["threads"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiFetch<ListResponse<Thread>>(
        `/v1/threads${workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : ""}`,
      );
      return res.data;
    },
  });
}

/** Create a thread with its first message and start its run. This is the one
 *  turn sent over HTTP, so the server can check the request before the thread
 *  exists; it replies once the thread is stored. Later turns go over the
 *  socket. */
export function createThread(
  text: string,
    opts: {
    agentId?: string;
    model?: string;
    connectors?: string[] | null;
    imageModel?: string;
    workspaceId?: string;
    /** false keeps the conversation to its creator; it is public otherwise */
    isShared?: boolean;
  },
) {
  return apiFetch<{ threadId: string; runId: string; seq: string }>("/v1/agent/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [{ id: crypto.randomUUID(), role: "user", content: text }], ...opts }),
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

/** One thread, fresh from the server (the list may not have it yet). */
export function useThreadRecord(threadId: string | undefined) {
  return useQuery({
    queryKey: ["thread", threadId],
    enabled: Boolean(threadId),
    staleTime: 60_000, // a move writes it
    queryFn: () => fetchThread(threadId!),
  });
}

export function useDeleteThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/threads/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    // The thread's artifacts go with it.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["threads"] }),
        qc.invalidateQueries({ queryKey: ["recent-artifacts"] }),
      ]),
  });
}
