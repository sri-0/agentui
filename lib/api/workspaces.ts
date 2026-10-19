"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";

import { ThreadIdContext } from "@/lib/chat/thread-context";
import { useUiStore } from "@/stores/ui-store";

import { apiFetch } from "./client";
import { useThreadRecord } from "./threads";
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
      // Its conversations and files stay, unfiled.
      return Promise.all([
        qc.invalidateQueries({ queryKey: ["workspaces"] }),
        qc.invalidateQueries({ queryKey: ["threads"] }),
        qc.invalidateQueries({ queryKey: ["files"] }),
      ]);
    },
  });
}

/** Files a conversation under a workspace or takes it out (null), pins or
 *  archives it; what is left undefined stays. */
export function useUpdateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, workspaceId, ...flags }: { threadId: string; workspaceId?: string | null } & Pick<Thread, "pinned" | "archived">) =>
      apiFetch<Thread>(`/v1/threads/${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        body: JSON.stringify({ workspace_id: workspaceId === undefined ? undefined : (workspaceId ?? ""), ...flags }),
      }),
    onSuccess: (thread) => {
      qc.setQueryData(["thread", thread.id], thread);
      return qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });
}

/** The workspace of the conversation being written in (null: none): its
 *  thread's, or for a new conversation the one the workspace bar picked. */
export function useChatWorkspaceId(): string | null {
  const threadId = useContext(ThreadIdContext);
  const { data: thread } = useThreadRecord(threadId ?? undefined);
  const newChatWorkspaceId = useUiStore((s) => s.newChatWorkspaceId);
  return threadId ? (thread?.workspace_id ?? null) : newChatWorkspaceId;
}
