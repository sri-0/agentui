"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiText } from "./client";
import type { ListResponse } from "./types";

/** A skill of the library: its name and description, from its SKILL.md, and
 *  the paths of its files, SKILL.md among them. */
export type Skill = {
  name: string;
  description: string;
  files: { path: string }[];
  updated_at: string;
};

/** The path of one of a skill's files on the server. */
export const skillFilePath = (name: string, path: string) =>
  `/v1/skills/${encodeURIComponent(name)}/files/${path.split("/").map(encodeURIComponent).join("/")}`;

/** The skills library by name. */
export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: async () => (await apiFetch<ListResponse<Skill>>("/v1/skills")).data ?? [],
  });
}

/** One of a skill's files as text, fetched once per version of the skill. */
export function useSkillFile(skill: Skill, path: string) {
  return useQuery({
    queryKey: ["skill-file", skill.name, skill.updated_at, path],
    staleTime: Infinity,
    queryFn: () => apiText(skillFilePath(skill.name, path)),
  });
}

/** Adds a skill from a zip of it or its SKILL.md, replacing any of the same
 *  name; the server reads the file as it is. */
export function useUploadSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      apiFetch<Skill>("/v1/skills", {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<void>(`/v1/skills/${encodeURIComponent(name)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skills"] }),
  });
}
