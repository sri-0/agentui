"use client";

import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/ai-elements/file-tree";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { API_URL } from "@/lib/api/client";
import { type Skill, skillFilePath, useDeleteSkill, useSkillFile, useSkills, useUploadSkill } from "@/lib/api/skills";
import { cn } from "@/lib/utils";
import { BookOpenIcon, ChevronLeftIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

/**
 * The skills library: the list, filtered as you type, and the skill picked
 * open beside it with its files. A skill is added by uploading a zip of it or
 * its SKILL.md. On a narrow screen the open skill replaces the list.
 */
export function SkillsView() {
  const { data: skills = [], error, isPending } = useSkills();
  const [filter, setFilter] = useState("");
  const [openName, setOpenName] = useState<string>();
  const open = skills.find((s) => s.name === openName);
  const q = filter.trim().toLowerCase();
  const shown = q
    ? skills.filter((s) => s.name.includes(q) || s.description.toLowerCase().includes(q))
    : skills;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger className="text-muted-foreground" />
        <h1 className="flex-1 text-sm font-semibold">Skills</h1>
        <UploadButton onUploaded={setOpenName} />
      </header>
      <div className="flex min-h-0 flex-1">
        <section
          aria-label="All skills"
          className={cn("w-full overflow-y-auto p-3 md:max-w-sm md:border-r", open && "hidden md:block")}
        >
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter skills"
            aria-label="Filter skills"
            className="mb-2"
          />
          {error && <p className="p-3 text-sm text-destructive">{error.message}</p>}
          {isPending && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
          {!isPending && !error && shown.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              {skills.length === 0 ? "No skills yet. Upload a skill's zip or its SKILL.md." : "No skill matches."}
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {shown.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => setOpenName(s.name)}
                  aria-current={s === open || undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
                    s === open && "bg-accent",
                  )}
                >
                  <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{s.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Skill" className={cn("min-w-0 flex-1 flex-col", open ? "flex" : "hidden md:flex")}>
          {open ? (
            <OpenSkill key={open.name} skill={open} onBack={() => setOpenName(undefined)} />
          ) : (
            <p className="m-auto text-sm text-muted-foreground">Pick a skill to open it.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function UploadButton({ onUploaded }: { onUploaded: (name: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadSkill();
  return (
    <>
      {upload.error && (
        <p role="alert" className="max-w-sm truncate text-xs text-destructive" title={upload.error.message}>
          {errorMessage(upload.error)}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept=".zip,.skill,.md"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload.mutate(file, { onSuccess: (s) => onUploaded(s.name) });
        }}
      />
      <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
        <UploadIcon className="size-4" /> {upload.isPending ? "Uploading…" : "Upload"}
      </Button>
    </>
  );
}

/** The server's refusal, without its JSON wrapping. */
function errorMessage(err: Error) {
  try {
    return (JSON.parse(err.message) as { message?: string }).message ?? err.message;
  } catch {
    return err.message;
  }
}

function OpenSkill({ skill, onBack }: { skill: Skill; onBack: () => void }) {
  const [path, setPath] = useState("SKILL.md");
  const del = useDeleteSkill();
  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon-sm" title="All skills" className="md:hidden" onClick={onBack}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{skill.name}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Delete skill"
          disabled={del.isPending}
          onClick={() => confirm(`Delete the skill ${skill.name}?`) && del.mutate(skill.name, { onSuccess: onBack })}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <p className="text-sm text-muted-foreground">{skill.description}</p>
          <Snippet code={`npx skills add ${API_URL} -s ${skill.name}`}>
            <SnippetInput aria-label="Install with npx skills" />
            <SnippetCopyButton />
          </Snippet>
          {/* picking a folder only opens or closes it */}
          <FileTree
            selectedPath={path}
            onSelect={(p) => skill.files.some((f) => f.path === p) && setPath(p)}
            defaultExpanded={new Set(folders(skill))}
          >
            {fileTree(skill.files.map((f) => f.path))}
          </FileTree>
          <SkillFile skill={skill} path={path} />
        </div>
      </div>
    </>
  );
}

/** Every folder of a skill's files, so the tree opens expanded. */
const folders = (skill: Skill) =>
  skill.files.flatMap((f) => f.path.split("/").slice(0, -1).map((_, i, dirs) => dirs.slice(0, i + 1).join("/")));

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

/** One file of a skill as written (rendering Markdown would drop text such
 *  as <placeholder>), or a link to it when it is not text. */
function SkillFile({ skill, path }: { skill: Skill; path: string }) {
  const { data: text, error, isPending } = useSkillFile(skill, path);
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (text.includes("�")) {
    return (
      <a className="text-sm underline" href={API_URL + skillFilePath(skill.name, path)} target="_blank" rel="noreferrer">
        Open {path}
      </a>
    );
  }
  return <pre className="whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-4 text-xs">{text}</pre>;
}
