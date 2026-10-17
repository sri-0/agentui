"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BoldIcon, CodeIcon, ItalicIcon, ListIcon, ListOrderedIcon, type LucideIcon } from "lucide-react";

/** The marks and lists a short Markdown text uses, as toolbar buttons. */
const TOOLS: {
  name: string;
  label: string;
  icon: LucideIcon;
  toggle: (e: Editor) => void;
}[] = [
  {
    name: "bold",
    label: "Bold",
    icon: BoldIcon,
    toggle: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    label: "Italic",
    icon: ItalicIcon,
    toggle: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: "code",
    label: "Code",
    icon: CodeIcon,
    toggle: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    name: "bulletList",
    label: "Bulleted list",
    icon: ListIcon,
    toggle: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    name: "orderedList",
    label: "Numbered list",
    icon: ListOrderedIcon,
    toggle: (e) => e.chain().focus().toggleOrderedList().run(),
  },
];

/**
 * A Markdown field edited as formatted text (Tiptap, reading and writing
 * Markdown): bold, italic, code and lists, for short texts such as a
 * skill's description. `value` is read when it mounts; each edit calls
 * `onChange` with the Markdown.
 */
export function MarkdownEditor({
  labelledBy,
  value,
  onChange,
  onBlur,
  placeholder,
  invalid,
}: {
  /** the id of its label: a label's for= cannot point at editable text */
  labelledBy?: string;
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
      }),
      Markdown,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    contentType: "markdown",
    immediatelyRender: false, // rendered on the server first
    editorProps: {
      attributes: {
        ...(labelledBy && { "aria-labelledby": labelledBy }),
        role: "textbox",
        "aria-multiline": "true",
        "aria-invalid": String(!!invalid),
        class: cn(
          "min-h-24 px-2.5 py-2 text-base outline-none md:text-sm [&_p]:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5",
          "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]",
          "[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
        ),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onBlur: () => onBlur?.(),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor }) => Object.fromEntries(TOOLS.map((t) => [t.name, editor?.isActive(t.name) ?? false])),
  });

  return (
    <div
      data-invalid={invalid || undefined}
      className="w-full rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive data-invalid:ring-destructive/20 dark:bg-input/30"
    >
      <div role="toolbar" aria-label="Formatting" className="flex gap-0.5 border-b p-1">
        {TOOLS.map((t) => (
          <Button
            key={t.name}
            type="button"
            variant={active?.[t.name] ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t.label}
            title={t.label}
            aria-pressed={active?.[t.name] ?? false}
            disabled={!editor}
            onClick={() => editor && t.toggle(editor)}
          >
            <t.icon />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
