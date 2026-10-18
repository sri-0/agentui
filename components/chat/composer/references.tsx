"use client";

import { usePromptInputController } from "@/components/ai-elements/prompt-input";
import { ReferenceChip } from "@/components/chat/reference-chip";
import { FileChipIcon } from "@/components/files/file-icon";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useAgents } from "@/lib/api/agents";
import { useFiles } from "@/lib/api/files";
import { useSkillFacets, useSkills } from "@/lib/api/skills";
import { useChatWorkspaceId, useWorkspaces } from "@/lib/api/workspaces";
import { colorsOf } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { Mention, type MentionNodeAttrs } from "@tiptap/extension-mention";
import { Placeholder } from "@tiptap/extensions";
import { PluginKey } from "@tiptap/pm/state";
import {
  type Editor,
  EditorContent,
  Extension,
  type JSONContent,
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BookOpenIcon, BotIcon, FileIcon, type LucideIcon, SparklesIcon } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

/**
 * A kind of reference the composer holds inline, as a chip in the text: the
 * sigil that lists its choices, and what the chip is on the wire. To add a
 * kind, add it here and its choices in `useChoices`.
 */
type Kind = {
  char: string;
  heading: string;
  icon: LucideIcon;
  /** what the chip reads as in the message sent; "" keeps it out */
  text: (attrs: MentionNodeAttrs) => string;
};

const KINDS: Kind[] = [
  // The server resolves `/name` to the skill's instructions (agentlite docs/SKILLS.md).
  { char: "/", heading: "Skills", icon: BookOpenIcon, text: (a) => `/${a.id}` },
  // The server does not resolve `@agent` yet (agentlite internal/refs), so an
  // agent chip sets the thread's agent when picked and stays out of the text.
  { char: "@", heading: "Agents", icon: BotIcon, text: () => "" },
  // The server gives the model the file `#id` names (agentlite docs/FILES.md).
  { char: "#", heading: "Files", icon: FileIcon, text: (a) => `#${a.id}` },
];

const kindOf = (char?: string | null) => KINDS.find((k) => k.char === char) ?? KINDS[0];

/** One choice of a kind, as the list shows it and as the chip keeps it. */
type Choice = {
  id: string;
  label: string;
  hint?: string;
  /** matched besides the label */
  keywords?: string;
  icon?: ReactNode;
  /** what picking it does besides inserting the chip */
  onPick?: () => void;
};

/** What the suggestion plugin reports while a sigil is being typed. */
type Suggest = { char: string; query: string; items: Choice[]; command: (attrs: MentionNodeAttrs) => void };

const matches = (c: Choice, q: string) =>
  q === "" || `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q.toLowerCase());

/** A chip: the node view of a reference in the text, with the icon its
 *  choice shows in the list (so coloured as there), or else its kind's. */
function Chip({ node }: NodeViewProps) {
  const attrs = node.attrs as MentionNodeAttrs;
  const kind = kindOf(attrs.mentionSuggestionChar);
  const choice = useChoices()[kind.char]?.find((c) => c.id === attrs.id);
  const Icon = kind.icon;
  return (
    <NodeViewWrapper as="span" className="inline">
      <ReferenceChip icon={choice?.icon ?? <Icon />}>{attrs.label ?? attrs.id}</ReferenceChip>
    </NodeViewWrapper>
  );
}

// Priorities order the key handlers: the list's keys first, then Enter to
// send, then the core keymap (100) that would otherwise split the paragraph.
const References = Mention.extend({
  name: "reference",
  priority: 300,
  addNodeView() {
    return ReactNodeViewRenderer(Chip, { as: "span" });
  },
});

/** Enter sends the form around the editor; Shift+Enter breaks the line. */
const Submit = Extension.create({
  name: "submit",
  priority: 200,
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        this.editor.view.dom.closest("form")?.requestSubmit();
        return true;
      },
      "Shift-Enter": () => this.editor.commands.setHardBreak(),
    };
  },
});

const doc = (text: string): JSONContent => ({
  type: "doc",
  content: text.split("\n").map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : undefined,
  })),
});

const editorClass = cn(
  "max-h-56 min-h-[60px] overflow-y-auto px-6 pt-5 pb-1 text-[15px] leading-relaxed outline-none [&_p]:m-0",
  "[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground/70 [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
);

/**
 * The composer's text, with references as chips inline: a Tiptap editor
 * whose Mention nodes are the chips, one list (shadcn's Command, in a
 * popover above the input) for every sigil in `KINDS`. The text the AI
 * Elements form sends is the editor's, each chip read through its kind, so
 * `/name` reaches the server where it was typed. Backspace after a chip
 * takes the chip. The keyboard stays in the editor: arrows, Enter or Tab,
 * Escape until the query changes or the sigil is left.
 *
 * Only this re-renders as the user types; the composer around it is memoized.
 */
export function ReferenceInput({
  placeholder,
  autoFocus,
  editorRef,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  /** filled with the editor, for controls that write into it (the voice prompt) */
  editorRef?: RefObject<Editor | null>;
}) {
  const { textInput } = usePromptInputController();
  const choices = useChoices();
  const workspace = useWorkspaceName();
  // What the editor's callbacks read; the editor is configured once.
  const choicesRef = useRef<Record<string, Choice[]>>({});
  const setInputRef = useRef(textInput.setInput);
  const keyRef = useRef<(e: KeyboardEvent) => boolean>(() => false);
  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const [dismissed, setDismissed] = useState<string>();
  const [selected, setSelected] = useState("");
  const [list, setList] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    choicesRef.current = choices;
    setInputRef.current = textInput.setInput;
  });

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: autoFocus ? "end" : false,
      content: doc(textInput.value),
      editorProps: { attributes: { class: editorClass, "aria-label": "Message", "aria-autocomplete": "list" } },
      onUpdate: ({ editor }) => setInputRef.current(editor.getText({ blockSeparator: "\n" })),
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          bold: false,
          italic: false,
          strike: false,
          code: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          underline: false,
          link: false,
        }),
        Placeholder.configure({ placeholder }),
        References.configure({
          deleteTriggerWithBackspace: true,
          renderText: ({ node, suggestion }) => kindOf(suggestion?.char).text(node.attrs as MentionNodeAttrs),
          renderHTML: ({ node, suggestion }) => [
            "span",
            { "data-type": "reference" },
            `${suggestion?.char ?? ""}${node.attrs.label ?? node.attrs.id}`,
          ],
          suggestions: KINDS.map((kind) => ({
            char: kind.char,
            pluginKey: new PluginKey(`reference-${kind.char}`),
            items: ({ query }: { query: string }) =>
              (choicesRef.current[kind.char] ?? []).filter((c) => matches(c, query)),
            render: () => {
              const show = (p: Omit<Suggest, "char">) =>
                setSuggest({ char: kind.char, query: p.query, items: p.items, command: p.command });
              return {
                onStart: show,
                onUpdate: show,
                onKeyDown: ({ event }: { event: KeyboardEvent }) => keyRef.current(event),
                onExit: () => {
                  setSuggest(null);
                  setDismissed(undefined);
                },
              };
            },
          })),
        }),
        Submit,
      ],
    },
    [],
  );

  // The placeholder changes with the thread (an open request, an images
  // conversation): the extension takes the new one, an empty transaction
  // redraws it.
  useEffect(() => {
    const ext = editor?.extensionManager.extensions.find((e) => e.name === "placeholder");
    if (!editor || !ext || ext.options.placeholder === placeholder) return;
    ext.options.placeholder = placeholder;
    editor.view.dispatch(editor.state.tr);
  }, [editor, placeholder]);

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // The form clears the text once it has sent it; the editor follows. Only
  // then: a chip that reads as nothing (an agent) leaves the text empty too.
  useEffect(() => {
    if (editor && textInput.value === "" && editor.getText({ blockSeparator: "\n" }) !== "") {
      editor.commands.clearContent();
    }
  }, [editor, textInput.value]);

  const items = suggest?.items ?? [];
  const kind = kindOf(suggest?.char);
  const files = kind.char === "#";
  // # opens on none too, to say why: files are the conversation's workspace's
  const open = !!suggest && suggest.query !== dismissed && (items.length > 0 || files);
  const heading = files ? `Files · ${workspace}` : kind.heading;
  const current = items.find((c) => c.id.toLowerCase() === selected.toLowerCase())?.id ?? items[0]?.id ?? "";
  const pick = (c: Choice) => {
    c.onPick?.();
    suggest?.command({ id: c.id, label: c.label });
  };

  useEffect(() => {
    keyRef.current = (e) => {
      if (!open || (!items.length && e.key !== "Escape")) return false;
      const index = items.findIndex((c) => c.id === current);
      switch (e.key) {
        case "ArrowDown":
          setSelected(items[(index + 1) % items.length].id);
          return true;
        case "ArrowUp":
          setSelected(items[(index - 1 + items.length) % items.length].id);
          return true;
        case "Enter":
        case "Tab":
          if (items[index]) pick(items[index]);
          return true;
        case "Escape":
          setDismissed(suggest?.query);
          return true;
        default:
          return false;
      }
    };
  });

  // The editor names the list and the selected option for assistive tech;
  // cmdk owns both ids, so they are read off the list once it has rendered.
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    const id = open ? list?.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]')?.id : undefined;
    dom.setAttribute("aria-expanded", String(open));
    if (id) dom.setAttribute("aria-activedescendant", id);
    else dom.removeAttribute("aria-activedescendant");
    if (open && list?.id) dom.setAttribute("aria-controls", list.id);
    else dom.removeAttribute("aria-controls");
  }, [editor, open, list, current, suggest]);

  return (
    <>
      {/* A popover, portaled: the input group clips anything drawn above it. */}
      <Popover open={open} onOpenChange={(o) => !o && setDismissed(suggest?.query)}>
        <PopoverAnchor asChild>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0" />
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // a click back into the editor keeps the list; anything else puts it away
          onInteractOutside={(e) => editor?.view.dom.contains(e.target as Node) && e.preventDefault()}
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command shouldFilter={false} value={current} onValueChange={setSelected}>
            <CommandList ref={setList} aria-label={heading}>
              <CommandEmpty className="px-3 py-3 text-left text-xs text-muted-foreground">
                {choices["#"]?.length
                  ? "No file matches"
                  : `${workspace === "No workspace" ? "No files outside a workspace" : `No files in ${workspace}`} yet — upload one on the Files page`}
              </CommandEmpty>
              <CommandGroup heading={heading}>
                {items.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => pick(c)}
                    // keep the focus in the editor; the keyboard works from there
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {c.icon}
                    <span className="shrink-0">{c.label}</span>
                    {c.hint && <span className="truncate text-muted-foreground">{c.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <EditorContent editor={editor} className="min-h-[60px] w-full" />
    </>
  );
}

/** The conversation's workspace's name, or "No workspace". */
function useWorkspaceName() {
  const id = useChatWorkspaceId();
  const { data: workspaces = [] } = useWorkspaces();
  return workspaces.find((w) => w.id === id)?.name ?? "No workspace";
}

/** The choices of each kind, by sigil. */
function useChoices(): Record<string, Choice[]> {
  const skills = useSkills().data?.data ?? [];
  const { categories } = useSkillFacets();
  const colorOf = colorsOf(categories);
  const { data: agents = [] } = useAgents();
  const setAgent = useUiStore((s) => s.setAgent);
  // the conversation's workspace's files: the ones its search_userfiles sees
  const { data: files = [] } = useFiles(useChatWorkspaceId());
  return {
    "/": skills.map((s) => ({
      id: s.name,
      label: s.name,
      hint: s.description,
      keywords: s.title,
      icon: <BookOpenIcon className={colorOf(s.category).text} />,
    })),
    "@": [
      {
        id: "auto",
        label: "Auto",
        hint: "the default agent",
        icon: <SparklesIcon className="text-[var(--ai-from)]" />,
        onPick: () => setAgent("auto"),
      },
      ...agents.map((a) => ({
        id: a.id,
        label: a.name,
        hint: a.description,
        keywords: a.id,
        icon: <BotIcon />,
        onPick: () => setAgent(a.id),
      })),
    ],
    "#": files.map((f) => ({
      id: f.id,
      label: f.name,
      hint: f.status === "ready" ? "searchable" : "reference only",
      icon: <FileChipIcon file={f} />,
    })),
  };
}
