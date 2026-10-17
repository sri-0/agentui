"use client";

import { Badge } from "@/components/ui/badge";
import { useSkills } from "@/lib/api/skills";
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

/** What the user typed; a leading /name that is a skill shows as a chip. */
export function UserText({ text }: { text: string }) {
  const skills = useSkills().data?.data ?? [];
  const m = /^\/([a-z0-9-]+)(?:\s+|$)/.exec(text);
  if (!m || !skills.some((s) => s.name === m[1])) return <Markdown>{text}</Markdown>;
  const rest = text.slice(m[0].length);
  return (
    <>
      <Badge variant="secondary" className="font-mono">
        <BookOpenIcon />
        {m[1]}
      </Badge>
      {rest && <Markdown>{rest}</Markdown>}
    </>
  );
}
