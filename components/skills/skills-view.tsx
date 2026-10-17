"use client";

import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/ai-elements/file-tree";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { Markdown } from "@/components/chat/messages/markdown";
import { LibraryItem, LibraryItems, LibraryPage, LibraryToolbar, NavItem, NavSection } from "@/components/library/library";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { API_URL } from "@/lib/api/client";
import { type Facet, type Skill, skillFilePath, useDeleteSkill, useSkillFile, useSkills } from "@/lib/api/skills";
import dayjs from "@/lib/dayjs";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronDownIcon,
  LibraryIcon,
  PencilIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { EditSkillDialog, errorMessage, UploadSkillDialog } from "./skill-dialogs";

/** The draft "Create with agent" opens a new chat with. */
const CREATE_PROMPT =
  "Help me create a new skill for the skills library. Ask me what it should do, its category and its source, " +
  "then write it with write_skill.";

/**
 * The skills library: categories and sources on the left, the skills they
 * choose as cards (or rows), searched by name, title or description. Picking
 * one opens it in place of the list (?skill=name), so back returns to it.
 * Create adds a skill with an agent or from an upload.
 */
export function SkillsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>();
  const [source, setSource] = useState<string>();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250); // one search once typing pauses
    return () => clearTimeout(t);
  }, [search]);

  const { data, error, isPending } = useSkills({ q, category, source });
  const { data: all } = useSkills(); // every skill: the total, and the options to file one under
  const skills = data?.data ?? [];
  const values = (facets?: Facet[]) => facets?.map((f) => f.value) ?? [];
  const categories = values(all?.categories);
  const sources = values(all?.sources);

  const openName = params.get("skill");
  const open = all?.data.find((s) => s.name === openName);
  const show = (name?: string) => router.push(name ? `${pathname}?skill=${encodeURIComponent(name)}` : pathname);

  const nav = (
    <>
      <NavSection>
        <NavItem
          icon={<LibraryIcon className="size-4" />}
          label="All skills"
          count={all?.data.length}
          active={!category && !source && !open}
          onClick={() => {
            setCategory(undefined);
            setSource(undefined);
            show();
          }}
        />
      </NavSection>
      <FacetNav
        label="Categories"
        facets={data?.categories}
        chosen={category}
        onChoose={(v) => {
          setCategory(v);
          show();
        }}
      />
      <FacetNav
        label="Sources"
        facets={data?.sources}
        chosen={source}
        onChoose={(v) => {
          setSource(v);
          show();
        }}
      />
    </>
  );

  if (open) {
    return (
      <LibraryPage title="Skills" nav={nav}>
        <OpenSkill key={open.name} skill={open} categories={categories} sources={sources} onBack={() => show()} />
      </LibraryPage>
    );
  }

  return (
    <LibraryPage title="Skills" nav={nav}>
      <LibraryToolbar
        heading={[category, source].filter(Boolean).join(" · ") || "All skills"}
        search={search}
        onSearch={setSearch}
        placeholder="Search skills"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full">
                Create <ChevronDownIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/chat?prompt=${encodeURIComponent(CREATE_PROMPT)}`)}>
                <SparklesIcon className="size-4" /> Create with agent
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setUploading(true)}>
                <UploadIcon className="size-4" /> Upload skill
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {error && <p className="text-sm text-destructive">{errorMessage(error)}</p>}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isPending && !error && skills.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {all?.data.length ? "No skill matches." : "No skills yet. Create one with an agent, or upload a skill's zip."}
        </p>
      )}
      <LibraryItems>
        {skills.map((s) => (
          <LibraryItem
            key={s.name}
            preview={<SkillPreview skill={s} />}
            icon={<BookOpenIcon className="size-4" />}
            title={s.title || s.name}
            subtitle={[s.category, s.source].filter(Boolean).join(" · ") || s.name}
            meta={dayjs(s.updated_at).fromNow()}
            onOpen={() => show(s.name)}
          />
        ))}
      </LibraryItems>
      <UploadSkillDialog
        open={uploading}
        onOpenChange={setUploading}
        categories={categories}
        sources={sources}
        onUploaded={(name) => show(name)}
      />
    </LibraryPage>
  );
}

/** A nav section of categories or sources with their counts; choosing the
 *  chosen one again clears it. */
function FacetNav({
  label,
  facets = [],
  chosen,
  onChoose,
}: {
  label: string;
  facets?: Facet[];
  chosen?: string;
  onChoose: (value?: string) => void;
}) {
  return (
    <NavSection label={label}>
      {facets.length === 0 && <span className="px-2 text-xs text-muted-foreground">None yet</span>}
      {facets.map((f) => (
        <NavItem
          key={f.value}
          label={f.value}
          count={f.count}
          active={chosen === f.value}
          onClick={() => onChoose(chosen === f.value ? undefined : f.value)}
        />
      ))}
    </NavSection>
  );
}

/** A skill's card face: its title and the start of its description, as a page. */
function SkillPreview({ skill }: { skill: Skill }) {
  return (
    <span className="flex w-full flex-col gap-2 p-5">
      <span className="flex items-center gap-2 text-muted-foreground">
        <BookOpenIcon className="size-4" />
        <span className="truncate font-mono text-xs">/{skill.name}</span>
      </span>
      <span className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">{plain(skill.description)}</span>
    </span>
  );
}

/** Markdown as plain text, for a few lines on a card. */
const plain = (md: string) => md.replace(/[*_`#>[\]]/g, "").replace(/\s+/g, " ").trim();

function OpenSkill({
  skill,
  categories,
  sources,
  onBack,
}: {
  skill: Skill;
  categories: string[];
  sources: string[];
  onBack: () => void;
}) {
  const [path, setPath] = useState("SKILL.md");
  const [editing, setEditing] = useState(false);
  const del = useDeleteSkill();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon className="size-4" /> Skills
        </Button>
        <span className="mr-auto" />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon className="size-4" /> Edit details
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={del.isPending}
          onClick={() => confirm(`Delete the skill ${skill.name}?`) && del.mutate(skill.name, { onSuccess: onBack })}
        >
          <Trash2Icon className="size-4" /> Delete
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{skill.title || skill.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">/{skill.name}</span>
          {skill.category && <Badge variant="secondary">{skill.category}</Badge>}
          {skill.source && <Badge variant="outline">{skill.source}</Badge>}
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
      <EditSkillDialog skill={skill} open={editing} onOpenChange={setEditing} categories={categories} sources={sources} />
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
      <a className="text-sm underline" href={API_URL + skillFilePath(skill.name, path)} target="_blank" rel="noreferrer">
        Open {path}
      </a>
    );
  }
  return <pre className="min-w-0 whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-4 text-xs">{text}</pre>;
}
