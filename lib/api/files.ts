"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { API_URL, apiFetch } from "./client";
import type { ListResponse } from "./types";

/** A file the user uploaded (agentlite docs/FILES.md): kept with a workspace,
 *  or with none. A ready file is embedded, so search_userfiles finds it; a
 *  stored one (a PDF) can only be referenced with #id. */
export type UserFile = {
  id: string;
  name: string;
  media_type: string;
  size: number;
  workspace_id?: string;
  /** the uploader's, for finding it */
  tags?: string[];
  status: "ready" | "stored";
  created_at: string;
};

/** The file itself, served with its own type. */
export const fileContentUrl = (id: string) => `${API_URL}/v1/rag/files/${encodeURIComponent(id)}/content`;

/** The files, newest first: every one (undefined), the unfiled ones (null),
 *  or one workspace's. */
export function useFiles(workspaceId?: string | null) {
  const workspace = workspaceId === undefined ? "" : (workspaceId ?? "none");
  return useQuery({
    queryKey: ["files", workspace],
    staleTime: 30_000,
    queryFn: async () =>
      (await apiFetch<ListResponse<UserFile>>(`/v1/rag/files${workspace && `?workspace=${encodeURIComponent(workspace)}`}`))
        .data,
  });
}

/** Reads a text with each #id of a known file as the file's name: a
 *  conversation's title is its first message as typed. */
export function useFileNames() {
  const { data: files } = useFiles();
  return useCallback(
    (text: string) =>
      files?.length
        ? text.replace(/#([0-9a-f-]{36})/g, (word, id: string) => files.find((f) => f.id === id)?.name ?? word)
        : text,
    [files],
  );
}

/** Uploads a file into a workspace (null: none), with tags. The reply comes
 *  once the file is embedded. */
export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, workspaceId, tags = [] }: { file: File; workspaceId: string | null; tags?: string[] }) => {
      const form = new FormData();
      form.set("file", file);
      if (workspaceId) form.set("workspaceId", workspaceId);
      for (const t of tags) form.append("tags", t);
      return apiFetch<UserFile>("/v1/rag/files", { method: "POST", body: form });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/rag/files/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
}
