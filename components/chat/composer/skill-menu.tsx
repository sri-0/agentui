"use client";

import { usePromptInputController } from "@/components/ai-elements/prompt-input";
import { type Skill, useSkills } from "@/lib/api/skills";
import { cn } from "@/lib/utils";
import { type KeyboardEvent, useState } from "react";

/**
 * The skills a message can load: while the composer holds only "/" and the
 * start of a name, the matching skills; picking one (click, Enter or Tab)
 * leaves "/name " to type the rest after. The server loads the skill when the
 * message is sent. Escape closes the menu until the text changes.
 */
export function useSkillMenu() {
  const { textInput } = usePromptInputController();
  const skills = useSkills().data?.data ?? [];
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string>();

  const typed = /^\/([a-z0-9-]*)$/.exec(textInput.value)?.[1];
  const matches =
    typed === undefined || textInput.value === dismissed ? [] : skills.filter((s) => s.name.includes(typed));
  const index = Math.min(active, matches.length - 1);

  const choose = (s: Skill) => {
    textInput.setInput(`/${s.name} `);
    setActive(0);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        setActive((index + 1) % matches.length);
        break;
      case "ArrowUp":
        setActive((index - 1 + matches.length) % matches.length);
        break;
      case "Enter":
      case "Tab":
        choose(matches[index]);
        break;
      case "Escape":
        setDismissed(textInput.value);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  return { matches, index, choose, onKeyDown };
}

export function SkillMenu({ matches, index, choose }: Omit<ReturnType<typeof useSkillMenu>, "onKeyDown">) {
  if (matches.length === 0) return null;
  return (
    <ul
      role="listbox"
      aria-label="Skills"
      className="absolute inset-x-0 bottom-full z-10 mb-2 max-h-64 overflow-y-auto rounded-2xl border bg-popover p-1 shadow-lg"
    >
      {matches.map((s, i) => (
        <li key={s.name} role="option" aria-selected={i === index}>
          <button
            type="button"
            // keep the focus in the composer
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(s)}
            className={cn(
              "flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-accent",
              i === index && "bg-accent",
            )}
          >
            <span className="font-mono text-sm">/{s.name}</span>
            <span className="line-clamp-1 text-xs text-muted-foreground">{s.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
