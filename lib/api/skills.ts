"use client";

import { colorsOf } from "@/lib/colors";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiText } from "./client";
import type { ListResponse } from "./types";

/** A skill of the library, by its id: its name (unique) and description,
 *  from its SKILL.md; the title, category and source the library files it
 *  under; and its files, SKILL.md among them. */
export type Skill = {
  id: string;
  name: string;
  title?: string;
  /** Markdown */
  description: string;
  category?: string;
  source?: string;
  files: { path: string; size: number }[];
  created_at: string;
  updated_at: string;
};

/** A category or source, with how many skills have it. */
export type Facet = { value: string; count: number };

export type SkillFilter = { q?: string; category?: string; source?: string };

type SkillList = ListResponse<Skill> & { categories: Facet[]; sources: Facet[] };

/** The editable details of a skill. */
export type SkillDetails = { title: string; description: string; category: string; source: string };

/** The path of one of a skill's files on the server. */
export const skillFilePath = (id: string, path: string) =>
  `/v1/skills/${encodeURIComponent(id)}/files/${path.split("/").map(encodeURIComponent).join("/")}`;

const keys = {
  all: ["skills"],
  lists: ["skills", "list"],
  list: (f: Record<string, string>) => ["skills", "list", f],
  detail: (id: string) => ["skills", "detail", id],
};

/** The skills library by name, as the filter narrows it, with the categories
 *  and sources of the skills its search matches (whatever category or source
 *  is chosen). The previous result stays while the next loads. */
export function useSkills(filter: SkillFilter = {}) {
  const set = Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) as Record<string, string>; // {q: ""} is {}
  return useQuery({
    queryKey: keys.list(set),
    placeholderData: keepPreviousData,
    queryFn: () => apiFetch<SkillList>(`/v1/skills?${new URLSearchParams(set)}`),
  });
}

/** The library's categories and sources, to file a skill under, and each
 *  category's colour. */
export function useSkillFacets() {
  const { data } = useSkills();
  const categories = data?.categories.map((f) => f.value) ?? [];
  const sources = data?.sources.map((f) => f.value) ?? [];
  return { categories, sources, colorOf: colorsOf(categories) };
}

/** One skill, by id. */
export function useSkill(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => apiFetch<Skill>(`/v1/skills/${encodeURIComponent(id)}`),
  });
}

/** One of a skill's files as text, fetched once per version of the skill. */
export function useSkillFile(skill: Skill, path: string) {
  return useQuery({
    queryKey: ["skill-file", skill.id, skill.updated_at, path],
    staleTime: Infinity,
    placeholderData: keepPreviousData, // a saved file stays in view while its new version loads
    queryFn: () => apiText(skillFilePath(skill.id, path)),
  });
}

/** Adds a skill from a zip of it or its SKILL.md, with the details given (an
 *  empty one keeps the SKILL.md's description, or what a replaced skill had). */
export function useUploadSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, details }: { file: File; details: SkillDetails }) => {
      const form = new FormData();
      form.set("file", file);
      for (const [k, v] of Object.entries(details)) if (v.trim()) form.set(k, v);
      return apiFetch<Skill>("/v1/skills", { method: "POST", body: form });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

/** Sets the details given on a skill; "" clears a title, category or source. */
export function useUpdateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, details }: { id: string; details: Partial<SkillDetails> }) =>
      apiFetch<Skill>(`/v1/skills/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(details) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

/** Replaces one of a skill's files, or adds it. */
export function useWriteSkillFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skill, path, content }: { skill: Skill; path: string; content: string }) =>
      apiFetch<Skill>(skillFilePath(skill.id, path), {
        method: "PUT",
        body: content,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

/** Deletes a skill. Only the lists refetch: the deleted one's page, still
 *  open until it navigates away, would get a 404. */
export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/skills/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.lists }),
  });
}
