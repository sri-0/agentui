"use client";

import { useSkills } from "@/lib/api/skills";
import type { SkillUse } from "@/lib/chat/types";
import { BookOpenIcon } from "lucide-react";
import { memo } from "react";

import { Markdown } from "./markdown";

/** The skill a /name message loaded into its turn (the `skill` activity). */
export const SkillLoaded = memo(function SkillLoaded({ data }: { data: SkillUse }) {
  return (
    <div className="my-0.5 flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground" title={data.description}>
      <BookOpenIcon className="size-3.5 shrink-0" />
      <span className="truncate">
        Loaded skill <span className="font-mono text-foreground">{data.name}</span>
      </span>
    </div>
  );
});

/** What the user typed; a leading /name that is a skill shows as a chip. */
export function UserText({ text }: { text: string }) {
  const skills = useSkills().data?.data ?? [];
  const m = /^\/([a-z0-9-]+)(?:\s+|$)/.exec(text);
  if (!m || !skills.some((s) => s.name === m[1])) return <Markdown>{text}</Markdown>;
  const rest = text.slice(m[0].length);
  return (
    <>
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
        <BookOpenIcon className="size-3" />
        {m[1]}
      </span>
      {rest && <Markdown>{rest}</Markdown>}
    </>
  );
}
