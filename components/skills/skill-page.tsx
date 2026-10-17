"use client";

import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/ai-elements/file-tree";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { Markdown } from "@/components/chat/messages/markdown";
import { LibraryPage } from "@/components/library/library";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api/client";
import { type Facet, type Skill, skillFilePath, useDeleteSkill, useSkill, useSkillFile, useSkills } from "@/lib/api/skills";
import { colorsOf } from "@/lib/colors";
import dayjs from "@/lib/dayjs";
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { EditSkillDialog, errorMessage } from "./skill-dialogs";
import { SkillIcon, SkillTags } from "./skills-view";

/** A skill's page (/skills/<id>): its details, how to install it, and its
 *  files; with Edit details and Delete. */
export function SkillPage({ id }: { id: string }) {
  const { data: skill, error } = useSkill(id);
  return (
    <LibraryPage title="Skills">
      {error && <p className="text-sm text-destructive">{errorMessage(error)}</p>}
      {skill && <SkillDetails key={skill.id} skill={skill} />}
    </LibraryPage>
  );
}

function SkillDetails({ skill }: { skill: Skill }) {
  const router = useRouter();
  const [path, setPath] = useState("SKILL.md");
  const [editing, setEditing] = useState(false);
  const del = useDeleteSkill();
  const { data: all } = useSkills(); // the categories and sources to file it under
  const values = (facets?: Facet[]) => facets?.map((f) => f.value) ?? [];
  const colorOf = colorsOf(values(all?.categories));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/skills">
            <ArrowLeftIcon /> Skills
          </Link>
        </Button>
        <span className="mr-auto" />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon /> Edit details
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={del.isPending}
          onClick={() =>
            confirm(`Delete the skill ${skill.name}?`) && del.mutate(skill.id, { onSuccess: () => router.push("/skills") })
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
        <SkillFile skill={skill} path={path} />
      </div>
      <EditSkillDialog
        skill={skill}
        open={editing}
        onOpenChange={setEditing}
        categories={values(all?.categories)}
        sources={values(all?.sources)}
      />
    </div>
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
      <a className="text-sm underline" href={API_URL + skillFilePath(skill.id, path)} target="_blank" rel="noreferrer">
        Open {path}
      </a>
    );
  }
  return <pre className="min-w-0 whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-4 text-xs">{text}</pre>;
}
