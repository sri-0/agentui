"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useEffect } from "react";

import { apiFetch } from "./client";
import type { ListResponse, Thread, ThreadMessage } from "./types";

function unwrap<T>(res: ListResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res.data ?? []);
}

export function useThreads() {
  return useQuery({
    queryKey: ["threads"],
    retry: false,
    // The title of a freshly-created thread is generated ASYNC by the backend a
    // few seconds after the run finishes. A modest poll (mirrors useSessions)
    // lets the new thread AND its generated title converge live without a
    // reload; the invalidate-on-finish in useAgentChat handles immediacy.
    refetchInterval: 5000,
    queryFn: async () => {
      // Thread persistence needs OpenSearch/Valkey; if it's down the backend
      // returns 500. Degrade gracefully to an empty list rather than erroring.
      try {
        const res = await apiFetch<ListResponse<Thread> | Thread[]>(
          "/v1/threads",
        );
        return unwrap(res);
      } catch {
        return [] as Thread[];
      }
    },
  });
}

export function useThreadMessages(threadId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["thread-messages", threadId],
    enabled: Boolean(threadId),
    retry: false,
    // Tool parts are persisted asynchronously as a run finishes. A thread opened
    // (or reloaded) in the window right after a run completes could load a
    // messages doc that hasn't yet grown its tool parts — leaving tool cards
    // missing until the next manual reload. The backend now flushes parts
    // synchronously before reporting done, but keep the client robust: refetch
    // when the tab regains focus so returning to a just-finished thread always
    // picks up the persisted parts.
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const res = await apiFetch<
          ListResponse<ThreadMessage> | ThreadMessage[]
        >(`/v1/threads/${threadId}/messages`);
        return unwrap(res);
      } catch {
        return [] as ThreadMessage[];
      }
    },
  });

  // One-shot delayed refetch shortly after opening a thread: cheap belt-and-
  // braces for the "opened exactly as the run finished" race — we re-pull once
  // (not a tight interval) so any parts persisted in the last moment appear
  // without the user reloading. Keyed on threadId so it fires once per open.
  useEffect(() => {
    if (!threadId) return;
    const t = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["thread-messages", threadId] });
    }, 1200);
    return () => clearTimeout(t);
  }, [threadId, qc]);

  return query;
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { title?: string }) =>
      apiFetch<Thread>("/v1/threads", {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });
}

export function useRenameThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetch<Thread>(`/v1/threads/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });
}

export function useDeleteThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/threads/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });
}
