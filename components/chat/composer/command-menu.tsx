"use client";

import { PromptInputTextarea, usePromptInputController } from "@/components/ai-elements/prompt-input";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useAgents } from "@/lib/api/agents";
import { useGroupedModels } from "@/lib/api/models";
import { useSkills } from "@/lib/api/skills";
import { useUiStore } from "@/stores/ui-store";
import { useRouter } from "next/navigation";
import { type ComponentProps, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type { ComposerStatus } from "./composer";

/** One line of the palette: what it shows, and what picking it does to the composer. */
type Item = {
  /** unique across the palette: `command:new`, `skill:<name>`, `model:<id>` */
  value: string;
  label: string;
  hint?: string;
  /** matched besides the label */
  keywords?: string;
  run: () => void;
};
type Group = { heading: string; items: Item[] };

/** What the palette follows: `/word`, or `/command rest` while a command picks among choices. */
const SLASH = /^\/([a-z0-9-]*)(?:\s+([\s\S]*))?$/i;

const matches = (item: Item, q: string) =>
  q === "" || `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(q.toLowerCase());

const filter = (groups: Group[], q: string) =>
  groups.map((g) => ({ ...g, items: g.items.filter((i) => matches(i, q)) })).filter((g) => g.items.length > 0);

/**
 * The composer's textarea with the `/` palette above it: one list for every
 * `/` command (new chat, the model, the agent, the library pages, stop) and
 * the skills a message can load. The backend treats `/` as the one sigil of a
 * reference, and `/name` for a skill is the only kind it resolves so far
 * (agentlite docs/SKILLS.md), so picking a skill leaves `/name ` in the text
 * and the server loads it when the message is sent; the other commands act
 * here. `/model ` and `/agent ` go on to list what they can switch to.
 *
 * The keyboard stays in the textarea (arrows, Enter or Tab, Escape until the
 * text changes); the list is shadcn's Command, told what is selected. Only
 * this re-renders as the user types.
 */
export function CommandTextarea({
  status,
  onStop,
  ...props
}: ComponentProps<typeof PromptInputTextarea> & { status: ComposerStatus; onStop?: () => void }) {
  const { textInput } = usePromptInputController();
  const [selected, setSelected] = useState("");
  const [dismissed, setDismissed] = useState<string>();
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const text = textInput.value;
  const parsed = text === dismissed ? null : SLASH.exec(text);
  const word = parsed?.[1] ?? "";
  const rest = parsed?.[2];
  const choosing = rest !== undefined;

  const commands = useCommands(status, onStop);
  const choices = useChoices();
  const skills = useSkills().data?.data;

  // Recomputed as the text changes: that is the render this component is for.
  const skillItems: Item[] = (skills ?? []).map((s) => ({
    value: `skill:${s.name}`,
    label: `/${s.name}`,
    hint: s.description,
    keywords: s.title,
    run: () => textInput.setInput(`/${s.name} `),
  }));
  const groups: Group[] = !parsed
    ? []
    : choosing
      ? filter(choices[word] ?? [], rest)
      : filter(
          [
            { heading: "Commands", items: commands },
            { heading: "Skills", items: skillItems },
          ],
          word,
        );
  const flat = groups.flatMap((g) => g.items);
  // a command's choices stay open on no match, to say so; the top level closes
  const open = flat.length > 0 || (choosing && word in choices);
  const current = flat.find((i) => i.value === selected)?.value ?? flat[0]?.value ?? "";

  // The textarea names the selected option for assistive tech; cmdk owns the
  // ids, so they are read off the list once it has rendered the selection.
  useEffect(() => {
    const id = open ? list?.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]')?.id : undefined;
    if (id) textarea.current?.setAttribute("aria-activedescendant", id);
    else textarea.current?.removeAttribute("aria-activedescendant");
  }, [open, list, current, text]);

  // Not memoized: the textarea is not, and this component renders per keystroke anyway.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    const index = flat.findIndex((i) => i.value === current);
    switch (e.key) {
      case "ArrowDown":
        if (flat.length) setSelected(flat[(index + 1) % flat.length].value);
        break;
      case "ArrowUp":
        if (flat.length) setSelected(flat[(index - 1 + flat.length) % flat.length].value);
        break;
      case "Enter":
      case "Tab":
        flat[index]?.run();
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
      {open && (
        <div className="absolute inset-x-0 bottom-full z-10 mb-2 overflow-hidden rounded-2xl border bg-popover shadow-lg">
          <Command shouldFilter={false} value={current} onValueChange={setSelected} className="bg-transparent">
            <CommandList ref={setList} id="command-menu" aria-label="Commands and skills" className="max-h-64">
              <CommandEmpty>Nothing matches</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.heading} heading={g.heading}>
                  {g.items.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={item.run}
                      // keep the focus in the composer; the keyboard works from there
                      onMouseDown={(e) => e.preventDefault()}
                      className="flex-col items-start gap-0 rounded-xl px-3 py-2"
                    >
                      <span className="font-mono text-sm">{item.label}</span>
                      {item.hint && <span className="line-clamp-1 text-xs text-muted-foreground">{item.hint}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </div>
      )}
      <PromptInputTextarea
        {...props}
        ref={textarea}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? "command-menu" : undefined}
      />
    </>
  );
}

/** The `/` commands the UI runs itself. A server-side one (`/compact`, which
 *  the backend's refs seam is meant for) would be a skill-like item that
 *  leaves its text in the message instead. */
function useCommands(status: ComposerStatus, onStop?: () => void): Item[] {
  const router = useRouter();
  const { textInput } = usePromptInputController();
  const requestNewChat = useUiStore((s) => s.requestNewChat);
  return useMemo(() => {
    const go = (href: string) => () => {
      textInput.clear();
      router.push(href);
    };
    const items: Item[] = [
      {
        value: "command:new",
        label: "/new",
        hint: "Start a new chat",
        run: () => {
          requestNewChat();
          go("/chat")();
        },
      },
      {
        value: "command:model",
        label: "/model",
        hint: "Switch the model",
        keywords: "models",
        run: () => textInput.setInput("/model "),
      },
      {
        value: "command:agent",
        label: "/agent",
        hint: "Switch the agent",
        keywords: "agents",
        run: () => textInput.setInput("/agent "),
      },
      { value: "command:artifacts", label: "/artifacts", hint: "Every conversation's artifacts", run: go("/artifacts") },
      { value: "command:skills", label: "/skills", hint: "The skills library", run: go("/skills") },
    ];
    if (status !== "ready" && onStop) {
      items.push({
        value: "command:stop",
        label: "/stop",
        hint: "Stop the run",
        run: () => {
          textInput.clear();
          onStop();
        },
      });
    }
    return items;
  }, [router, textInput, requestNewChat, status, onStop]);
}

/** What `/model` and `/agent` choose among. */
function useChoices(): Record<string, Group[]> {
  const { textInput } = usePromptInputController();
  const { groups: providers } = useGroupedModels();
  const { data: agents = [] } = useAgents();
  const setModel = useUiStore((s) => s.setModel);
  const setAgent = useUiStore((s) => s.setAgent);
  return useMemo(() => {
    const pick = (set: () => void) => () => {
      set();
      textInput.clear();
    };
    return {
      model: providers.map((p) => ({
        heading: p.providerName,
        items: p.models.map((m) => ({
          value: `model:${m.id}`,
          label: m.name ?? m.id,
          hint: m.id,
          run: pick(() => setModel(m.id)),
        })),
      })),
      agent: [
        {
          heading: "Agents",
          items: [
            { value: "agent:auto", label: "Auto", hint: "The default agent", run: pick(() => setAgent("auto")) },
            { value: "agent:none", label: "Model only", hint: "No agent, the bare model", run: pick(() => setAgent(null)) },
            ...agents.map((a) => ({
              value: `agent:${a.id}`,
              label: a.name,
              hint: a.description,
              keywords: a.id,
              run: pick(() => setAgent(a.id)),
            })),
          ],
        },
      ],
    };
  }, [providers, agents, setModel, setAgent, textInput]);
}
