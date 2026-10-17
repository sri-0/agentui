"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Artifact } from "@/lib/chat/types";

import { apiFetch } from "./client";

export type ImageRequest = {
  prompt: string;
  /** an image model; omitted, the server's default */
  model?: string;
  /** the Images conversation; omitted, a new one */
  threadId?: string;
  /** an image of the conversation to edit */
  edit?: string;
};

/** Makes an image on the Images page (POST /v1/images): kept as an artifact
 *  of the page's conversation, which the first image starts. */
export function useMakeImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ImageRequest) =>
      apiFetch<{ threadId: string; artifact: Artifact }>("/v1/images", { method: "POST", body: JSON.stringify(req) }),
    onSuccess: ({ threadId }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["artifacts", threadId] }),
        qc.invalidateQueries({ queryKey: ["recent-artifacts"] }),
        qc.invalidateQueries({ queryKey: ["threads"] }),
      ]),
  });
}
