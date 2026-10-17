"use client";

import { PromptInputTextarea, usePromptInputController } from "@/components/ai-elements/prompt-input";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useAgents } from "@/lib/api/agents";
import { useSkillFacets, useSkills } from "@/lib/api/skills";
import { colorsOf } from "@/lib/colors";
import { useUiStore } from "@/stores/ui-store";
import { BookOpenIcon, BotIcon, SparklesIcon } from "lucide-react";
import {
  type ComponentProps,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

/** One row of the palette: what it shows, and what picking it does. */
type Item = {
  /** unique across the palette: `skill:<name>`, `agent:<id>` */
  value: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  /** matched besides the label */
  keywords?: string;
  run: () => void;
};

/** What the palette follows: the whole text is a sigil and the start of a name. */
const SIGIL = /^([/@])([a-z0-9-]*)$/i;

const matches = (item: Item, q: string) =>
  q === "" || `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(q.toLowerCase());

/**
 * The composer's textarea with the palette above it, one shadcn Command list
 * for two sigils: `/` lists the skills a message can load and `@` the agents.
 * The backend resolves references by sigil and `/name` for a skill is the only
 * kind so far (agentlite docs/SKILLS.md): picking a skill makes it a chip in
 * the composer, which sends it ahead of the text as `/name`. `@agent` is not
 * resolved yet, so picking an agent sets the thread's agent, as the selector
 * does, and clears the text.
 *
 * The keyboard stays in the textarea (arrows, Enter or Tab, Escape until the
 * text changes); the list is told what is selected. Only this re-renders as
 * the user types.
 */
export function CommandTextarea({
  skills,
  onSkillsChange,
  ...props
}: ComponentProps<typeof PromptInputTextarea> & {
  /** the skills the message loads, the composer's chips */
  skills: string[];
  onSkillsChange: Dispatch<SetStateAction<string[]>>;
}) {
  const { textInput } = usePromptInputController();
  const [selected, setSelected] = useState("");
  const [dismissed, setDismissed] = useState<string>();
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const text = textInput.value;
  const parsed = text === dismissed ? null : SIGIL.exec(text);
  const sigil = parsed?.[1];
  const word = parsed?.[2] ?? "";

  // Loading a skill: a chip, and the text cleared for the message itself.
  const load = (name: string) => {
    onSkillsChange((s) => (s.includes(name) ? s : [...s, name]));
    textInput.clear();
  };
  const skillItems = useSkillItems(load);
  const agentItems = useAgentItems();
  const heading = sigil === "/" ? "Skills" : "Agents";
  const items = (sigil === "/" ? skillItems : sigil === "@" ? agentItems : []).filter((i) => matches(i, word));
  const open = items.length > 0;
  const current = items.find((i) => i.value === selected)?.value ?? items[0]?.value ?? "";

  // The textarea names the list and the selected option for assistive tech;
  // cmdk owns both ids, so they are read off the list once it has rendered.
  useEffect(() => {
    const ta = textarea.current;
    if (!ta) return;
    const id = open ? list?.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]')?.id : undefined;
    if (id) ta.setAttribute("aria-activedescendant", id);
    else ta.removeAttribute("aria-activedescendant");
    if (open && list?.id) ta.setAttribute("aria-controls", list.id);
    else ta.removeAttribute("aria-controls");
  }, [open, list, current, text]);

  // Not memoized: the textarea is not, and this component renders per keystroke anyway.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Backspace on empty text takes the last chip back; a space after a whole
    // skill name makes it a chip, as picking it would.
    if (e.key === "Backspace" && text === "" && skills.length > 0) {
      onSkillsChange((s) => s.slice(0, -1));
      e.preventDefault();
      return;
    }
    if (e.key === " " && sigil === "/" && skillItems.some((i) => i.label === word.toLowerCase())) {
      load(word.toLowerCase());
      e.preventDefault();
      return;
    }
    if (!open) return;
    const index = items.findIndex((i) => i.value === current);
    switch (e.key) {
      case "ArrowDown":
        setSelected(items[(index + 1) % items.length].value);
        break;
      case "ArrowUp":
        setSelected(items[(index - 1 + items.length) % items.length].value);
        break;
      case "Enter":
      case "Tab":
        items[index]?.run();
        break;
      case "Escape":
        setDismissed(text);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <>
      {/* A popover, portaled: the input group clips anything drawn above it. */}
      <Popover open={open} onOpenChange={(o) => !o && setDismissed(text)}>
        <PopoverAnchor asChild>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0" />
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // a click back into the textarea keeps the list; anything else puts it away
          onInteractOutside={(e) => textarea.current?.contains(e.target as Node) && e.preventDefault()}
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command shouldFilter={false} value={current} onValueChange={setSelected}>
            <CommandList ref={setList} aria-label={heading}>
              <CommandGroup heading={heading}>
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    onSelect={item.run}
                    // keep the focus in the composer; the keyboard works from there
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {item.icon}
                    <span className="shrink-0">{item.label}</span>
                    {item.hint && <span className="truncate text-muted-foreground">{item.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <PromptInputTextarea {...props} ref={textarea} onKeyDown={onKeyDown} aria-autocomplete="list" aria-expanded={open} />
    </>
  );
}

/** `/`: the skills of the library, each in its category's colour. */
function useSkillItems(load: (name: string) => void): Item[] {
  const skills = useSkills().data?.data ?? [];
  const { categories } = useSkillFacets();
  const colorOf = colorsOf(categories);
  return skills.map((s) => ({
    value: `skill:${s.name}`,
    icon: <BookOpenIcon className={colorOf(s.category).text} />,
    label: s.name,
    hint: s.description,
    keywords: s.title,
    run: () => load(s.name),
  }));
}

/** `@`: the default agent and the configured ones. */
function useAgentItems(): Item[] {
  const { textInput } = usePromptInputController();
  const { data: agents = [] } = useAgents();
  const setAgent = useUiStore((s) => s.setAgent);
  const pick = (id: string) => () => {
    setAgent(id);
    textInput.clear();
  };
  return [
    {
      value: "agent:auto",
      icon: <SparklesIcon className="text-[var(--ai-from)]" />,
      label: "Auto",
      hint: "the default agent",
      run: pick("auto"),
    },
    ...agents.map((a) => ({
      value: `agent:${a.id}`,
      icon: <BotIcon />,
      label: a.name,
      hint: a.description,
      keywords: a.id,
      run: pick(a.id),
    })),
  ];
}
