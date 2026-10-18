"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUiStore } from "@/stores/ui-store";

import { apiFetch } from "./client";
import type { ListResponse, Thread, Workspace } from "./types";

const path = (id: string) => `/v1/workspaces/${encodeURIComponent(id)}`;

/** The workspaces conversations are filed under, by name. */
export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    staleTime: 60_000,
    queryFn: async () => (await apiFetch<ListResponse<Workspace>>("/v1/workspaces")).data,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Workspace>("/v1/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useRenameWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<Workspace>(path(id), { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

/** Deletes a workspace; its conversations stay, outside any workspace. */
export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(path(id), { method: "DELETE" }),
    onSuccess: (_, id) => {
      // The next new conversation no longer has it to go into.
      const ui = useUiStore.getState();
      if (ui.newChatWorkspaceId === id) ui.setNewChatWorkspace(null);
      return Promise.all([
        qc.invalidateQueries({ queryKey: ["workspaces"] }),
        qc.invalidateQueries({ queryKey: ["threads"] }),
      ]);
    },
  });
}

/** Files a conversation under a workspace, or takes it out (null). */
export function useMoveThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, workspaceId }: { threadId: string; workspaceId: string | null }) =>
      apiFetch<Thread>(`/v1/threads/${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        body: JSON.stringify({ workspace_id: workspaceId ?? "" }),
      }),
    onSuccess: (thread) => {
      qc.setQueryData(["thread", thread.id], thread);
      return qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });
}
