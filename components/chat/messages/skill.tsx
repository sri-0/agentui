"use client";

import type { SkillUse } from "@/lib/chat/types";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

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
