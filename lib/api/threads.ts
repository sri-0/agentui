"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

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
  return useQuery({
    queryKey: ["thread-messages", threadId],
    enabled: Boolean(threadId),
    retry: false,
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
