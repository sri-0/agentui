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

/** Makes a workspace: public, so everyone with access to the control set
 *  sees it, unless isShared is false. */
export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, isShared }: { name: string; isShared?: boolean }) =>
      apiFetch<Workspace>("/v1/workspaces", { method: "POST", body: JSON.stringify({ name, is_shared: isShared }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

/** Renames a workspace, or shares it or keeps it to its creator; what is
 *  left undefined stays. */
export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, isShared }: { id: string; name?: string; isShared?: boolean }) =>
      apiFetch<Workspace>(path(id), { method: "PATCH", body: JSON.stringify({ name, is_shared: isShared }) }),
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

/** Files a conversation under a workspace or takes it out (null), renames,
 *  pins or archives it, or shares it (isShared: readable by its link by
 *  everyone with access to its control set) or keeps it to its creator; what
 *  is left undefined stays. */
export function useUpdateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      workspaceId,
      isShared,
      ...flags
    }: { threadId: string; workspaceId?: string | null; isShared?: boolean } & Pick<Thread, "title" | "pinned" | "archived">) =>
      apiFetch<Thread>(`/v1/threads/${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          workspace_id: workspaceId === undefined ? undefined : (workspaceId ?? ""),
          is_shared: isShared,
          ...flags,
        }),
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
