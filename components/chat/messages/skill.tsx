"use client";

import { ReferenceChip } from "@/components/chat/reference-chip";
import { useSkillFacets, useSkills } from "@/lib/api/skills";
import type { SkillUse } from "@/lib/chat/types";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

import { Markdown } from "./markdown";

/** A skill a /name loaded into its turn (the `skill` activity), linking to
 *  its page. */
export const SkillLoaded = memo(function SkillLoaded({ data }: { data: SkillUse }) {
  const name = <span className="font-medium text-foreground">{data.title || data.name}</span>;
  return (
    <div className="my-0.5 flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground" title={data.description}>
      <BookOpenIcon className="size-3.5 shrink-0" />
      <span className="truncate">
        Loaded skill{" "}
        {data.id ? (
          <Link href={`/skills/${encodeURIComponent(data.id)}`} className="underline-offset-2 hover:underline">
            {name}
          </Link>
        ) : (
          name
        )}
      </span>
    </div>
  );
});

/** What the user typed; each /name that is a skill shows as a chip. A text
 *  that is only chips and plain words renders as such, inline; otherwise the
 *  leading chips come first and the rest is Markdown. */
export function UserText({ text }: { text: string }) {
  const skills = useSkills().data?.data ?? [];
  const { colorOf } = useSkillFacets();
  const byName = new Map(skills.map((s) => [s.name, s]));
  const isRef = (word: string) => /^\/[a-z0-9-]+$/.test(word) && byName.has(word.slice(1));
  const chip = (word: string, key: number) => (
    <ReferenceChip
      key={key}
      className="mx-0.5"
      icon={<BookOpenIcon className={colorOf(byName.get(word.slice(1))?.category).text} />}
    >
      {word.slice(1)}
    </ReferenceChip>
  );
  const words = text.split(/(\s+)/);
  if (!words.some(isRef)) return <Markdown>{text}</Markdown>;
  // leading chips, then the rest as Markdown
  let i = 0;
  while (i < words.length && (isRef(words[i]) || /^\s+$/.test(words[i]))) i++;
  const rest = words.slice(i).join("");
  if (!words.slice(i).some(isRef)) {
    return (
      <>
        {words.slice(0, i).filter(isRef).map(chip)}
        {rest && <Markdown>{rest}</Markdown>}
      </>
    );
  }
  return <p className="whitespace-pre-wrap">{words.map((w, k) => (isRef(w) ? chip(w, k) : w))}</p>;
}
