"use client";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContainer,
  CodeBlockContent,
  CodeBlockFilename,
  CodeBlockHeader,
} from "@/components/ai-elements/code-block";
import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/ai-elements/file-tree";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { Markdown } from "@/components/chat/messages/markdown";
import { CopyButton } from "@/components/library/copy-button";
import { LibraryPage } from "@/components/library/library";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_URL } from "@/lib/api/client";
import {
  type Skill,
  skillFilePath,
  useDeleteSkill,
  useSkill,
  useSkillFacets,
  useSkillFile,
  useWriteSkillFile,
} from "@/lib/api/skills";
import dayjs from "@/lib/dayjs";
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { type BundledLanguage, bundledLanguages } from "shiki";

import { EditSkillDialog } from "./skill-dialogs";
import { SkillIcon, SkillTags } from "./skill-icon";

/** A skill's page (/skills/<id>): its details, how to install it, and its
 *  files; with Edit details and Delete. The list's filters ride along in the
 *  query, so Skills goes back to them. */
export function SkillPage({ id }: { id: string }) {
  const { data: skill, error } = useSkill(id);
  const params = useSearchParams();
  const back = params.size ? `/skills?${params}` : "/skills";
  return (
    <LibraryPage title="Skills">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {skill && <SkillDetails key={skill.id} skill={skill} back={back} />}
    </LibraryPage>
  );
}

function SkillDetails({ skill, back }: { skill: Skill; back: string }) {
  const router = useRouter();
  const [path, setPath] = useState("SKILL.md");
  const [editing, setEditing] = useState(false);
  const del = useDeleteSkill();
  const { colorOf } = useSkillFacets();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={back}>
            <ArrowLeftIcon /> Skills
          </Link>
        </Button>
        <span className="mr-auto" />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon /> Edit details
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={del.isPending}
          onClick={() =>
            confirm(`Delete the skill ${skill.name}?`) && del.mutate(skill.id, { onSuccess: () => router.push(back) })
          }
        >
          <Trash2Icon /> Delete
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <SkillIcon color={colorOf(skill.category)} className="size-11" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{skill.title || skill.name}</h1>
            <span className="font-mono text-xs text-muted-foreground">/{skill.name}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <SkillTags skill={skill} color={colorOf(skill.category)} />
          <span>Created {dayjs(skill.created_at).format("D MMM YYYY")}</span>
          <span>· Updated {dayjs(skill.updated_at).fromNow()}</span>
        </div>
        <Markdown>{skill.description}</Markdown>
      </div>
      <Snippet code={`npx skills add ${API_URL} -s ${skill.name}`}>
        <SnippetInput aria-label="Install with npx skills" />
        <SnippetCopyButton />
      </Snippet>
      <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        {/* picking a folder only opens or closes it */}
        <FileTree
          selectedPath={path}
          onSelect={(p) => skill.files.some((f) => f.path === p) && setPath(p)}
          defaultExpanded={new Set(folders(skill))}
          className="self-start"
        >
          {fileTree(skill.files.map((f) => f.path))}
        </FileTree>
        <SkillFile key={path} skill={skill} path={path} />
      </div>
      <EditSkillDialog skill={skill} open={editing} onOpenChange={setEditing} />
    </div>
  );
}

/** Every folder of a skill's files, so the tree opens expanded. */
const folders = (skill: Skill) =>
  skill.files.flatMap((f) =>
    f.path
      .split("/")
      .slice(0, -1)
      .map((_, i, dirs) => dirs.slice(0, i + 1).join("/")),
  );

/** The tree of a skill's files, from their paths: files first, then folders. */
function fileTree(paths: string[], dir = ""): ReactNode[] {
  const files: ReactNode[] = [];
  const subdirs = new Set<string>();
  for (const p of paths) {
    const rest = p.slice(dir.length);
    const slash = rest.indexOf("/");
    if (slash < 0) files.push(<FileTreeFile key={p} path={p} name={rest} />);
    else subdirs.add(rest.slice(0, slash));
  }
  return [
    ...files,
    ...[...subdirs].map((name) => {
      const path = dir + name;
      return (
        <FileTreeFolder key={path} path={path} name={name}>
          {fileTree(
            paths.filter((p) => p.startsWith(path + "/")),
            path + "/",
          )}
        </FileTreeFolder>
      );
    }),
  ];
}

/** One of a skill's files under its path, in Preview and Edit tabs: Markdown
 *  rendered (SKILL.md's frontmatter as YAML), code highlighted, or the file as
 *  written in an editor, saved from the header. Preview shows unsaved edits.
 *  A file that is not text is a link. */
function SkillFile({ skill, path }: { skill: Skill; path: string }) {
  const { data: text, error, isPending } = useSkillFile(skill, path);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const write = useWriteSkillFile();
  const form = useForm({ values: { content: text ?? "" } }); // follows the saved file
  const content = useWatch({ control: form.control, name: "content" });
  const { isDirty } = form.formState;
  const editable = text != null && !text.includes("�");
  const formId = `skill-file-${path}`;
  const cancel = () => {
    form.reset();
    setMode("preview");
  };

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="gap-0 self-start">
      <CodeBlockContainer language={language(path) ?? "text"}>
        <CodeBlockHeader>
          <CodeBlockFilename>{path}</CodeBlockFilename>
          {editable && (
            <CodeBlockActions className="gap-1">
              <TabsList aria-label="View">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="edit">
                  <PencilIcon /> Edit
                </TabsTrigger>
              </TabsList>
              {mode === "edit" || isDirty ? (
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form={formId}
                    size="sm"
                    className="ai-gradient-strong text-white hover:opacity-90"
                    disabled={!isDirty || write.isPending}
                  >
                    {write.isPending ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <CopyButton text={text} />
              )}
            </CodeBlockActions>
          )}
        </CodeBlockHeader>
        {error ? (
          <p className="p-6 text-sm text-destructive">{error.message}</p>
        ) : isPending ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !editable ? (
          <a
            className="block p-6 text-sm underline"
            href={API_URL + skillFilePath(skill.id, path)}
            target="_blank"
            rel="noreferrer"
          >
            Open {path}
          </a>
        ) : (
          <form
            id={formId}
            className="flex flex-col gap-3 p-6"
            onSubmit={form.handleSubmit(({ content }) =>
              write.mutate({ skill, path, content }, { onSuccess: () => setMode("preview") }),
            )}
          >
            {write.error && (
              <p role="alert" className="text-sm text-destructive">
                {write.error.message}
              </p>
            )}
            <TabsContent value="edit">
              <Textarea
                {...form.register("content")}
                aria-label={`Edit ${path}`}
                spellCheck={false}
                autoFocus
                className="min-h-80 font-mono text-xs md:text-xs"
              />
            </TabsContent>
            <TabsContent value="preview">
              <FilePreview path={path} text={content} />
            </TabsContent>
          </form>
        )}
      </CodeBlockContainer>
    </Tabs>
  );
}

/** The shiki language of a file, by its extension. */
function language(path: string): BundledLanguage | undefined {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ext in bundledLanguages ? (ext as BundledLanguage) : undefined;
}

function FilePreview({ path, text }: { path: string; text: string }) {
  const lang = language(path);
  if (lang === "md") {
    const [, front, body] = /^(?:---\n([\s\S]*?)\n---\n)?([\s\S]*)$/.exec(text) ?? [];
    return (
      <div className="flex flex-col gap-4">
        {front && <CodeBlock code={front} language="yaml" />}
        <Markdown>{body ?? text}</Markdown>
      </div>
    );
  }
  if (lang) return <CodeBlockContent code={text} language={lang} showLineNumbers />;
  return <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">{text}</pre>;
}
