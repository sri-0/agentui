import { Badge } from "@/components/ui/badge";
import type { Skill } from "@/lib/api/skills";
import type { Color } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { BookOpenIcon } from "lucide-react";

/** A skill's icon: a tile in its category's gradient. */
export function SkillIcon({ color, className }: { color: Color; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-xs",
        color.gradient,
        className,
      )}
    >
      <BookOpenIcon className="size-4" />
    </span>
  );
}

/** A skill's category, in its colour, and source. */
export function SkillTags({ skill, color }: { skill: Skill; color: Color }) {
  if (!skill.category && !skill.source) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {skill.category && (
        <Badge variant="outline" className={color.badge}>
          {skill.category}
        </Badge>
      )}
      {skill.source && <Badge variant="outline">{skill.source}</Badge>}
    </span>
  );
}
