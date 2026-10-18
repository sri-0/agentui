"use client";

import { ReferenceChip } from "@/components/chat/reference-chip";
import { FileChipIcon } from "@/components/files/file-icon";
import { useFiles } from "@/lib/api/files";
import { useSkillFacets, useSkills } from "@/lib/api/skills";
import { BookOpenIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Markdown } from "./markdown";

/** What the user typed; each /name that is a skill and each #id that is a
 *  file shows as a chip. A text that is only chips and plain words renders
 *  as such, inline; otherwise the leading chips come first and the rest is
 *  Markdown. */
export function UserText({ text }: { text: string }) {
  const skills = useSkills().data?.data ?? [];
  const files = useFiles().data ?? [];
  const { colorOf } = useSkillFacets();
  const skillByName = new Map(skills.map((s) => [s.name, s]));
  const fileById = new Map(files.map((f) => [f.id, f]));
  const refOf = (word: string): { icon: ReactNode; label: string } | undefined => {
    if (/^\/[a-z0-9-]+$/.test(word)) {
      const s = skillByName.get(word.slice(1));
      return s && { icon: <BookOpenIcon className={colorOf(s.category).text} />, label: s.name };
    }
    if (word.startsWith("#")) {
      const f = fileById.get(word.slice(1));
      return f && { icon: <FileChipIcon file={f} />, label: f.name };
    }
  };
  const isRef = (word: string) => refOf(word) !== undefined;
  const chip = (word: string, key: number) => {
    const ref = refOf(word)!;
    return (
      <ReferenceChip key={key} className="mx-0.5" icon={ref.icon}>
        {ref.label}
      </ReferenceChip>
    );
  };
  const words = text.split(/(\s+)/);
  if (!words.some(isRef)) return <Markdown>{text}</Markdown>;
  // leading chips, then the rest as Markdown
  let i = 0;
  while (i < words.length && (isRef(words[i]) || /^\s+$/.test(words[i]))) i++;
  const rest = words.slice(i).join("");
  if (!words.slice(i).some(isRef)) {
    return (
      <>
        <div className="flex flex-wrap gap-1">{words.slice(0, i).filter(isRef).map(chip)}</div>
        {rest && <Markdown>{rest}</Markdown>}
      </>
    );
  }
  return <p className="whitespace-pre-wrap">{words.map((w, k) => (isRef(w) ? chip(w, k) : w))}</p>;
}
