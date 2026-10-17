"use client";

import { LibraryItem, LibraryItems, LibraryPage, LibraryToolbar, NavItem, NavSection } from "@/components/library/library";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Facet, type Skill, useSkills } from "@/lib/api/skills";
import { type Color, colorsOf } from "@/lib/colors";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { BookOpenIcon, ChevronDownIcon, LibraryIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { errorMessage, UploadSkillDialog } from "./skill-dialogs";

/** The draft "Create with agent" opens a new chat with. */
const CREATE_PROMPT =
  "Help me create a new skill for the skills library. Ask me what it should do, its category and its source, " +
  "then write it with write_skill.";

/**
 * The skills library: categories and sources in a panel beside the skills
 * they choose, as cards (or rows), searched by name, title or description.
 * The choices are in the URL (?category=&source=), so a skill's page
 * (/skills/<id>) goes back to them. Create adds a skill with an agent or from
 * an upload.
 */
export function SkillsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const category = params.get("category") ?? undefined;
  const source = params.get("source") ?? undefined;

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250); // one search once typing pauses
    return () => clearTimeout(t);
  }, [search]);

  const { data, error, isPending } = useSkills({ q, category, source });
  const { data: all } = useSkills(); // every skill: the total, and the options to file one under
  const skills = data?.data ?? [];
  const values = (facets?: Facet[]) => facets?.map((f) => f.value) ?? [];
  const colorOf = colorsOf(values(all?.categories)); // the same whatever is chosen

  const choose = (choice: { category?: string; source?: string }) => {
    const next = new URLSearchParams(Object.entries({ category, source, ...choice }).filter(([, v]) => v) as [string, string][]);
    router.replace(next.size ? `${pathname}?${next}` : pathname);
  };
  const open = (id: string) => router.push(`/skills/${encodeURIComponent(id)}`);

  const nav = (
    <>
      <NavItem
        icon={<LibraryIcon className="size-4 text-muted-foreground" />}
        label="All skills"
        count={all?.data.length}
        active={!category && !source}
        onClick={() => choose({ category: undefined, source: undefined })}
      />
      <FacetNav
        label="Categories"
        facets={data?.categories}
        chosen={category}
        colorOf={colorOf}
        onChoose={(v) => choose({ category: v })}
      />
      <FacetNav label="Sources" facets={data?.sources} chosen={source} onChoose={(v) => choose({ source: v })} />
    </>
  );

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
              <Button>
                Create <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem onSelect={() => router.push(`/chat?prompt=${encodeURIComponent(CREATE_PROMPT)}`)}>
                <SparklesIcon /> Create with agent
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setUploading(true)}>
                <UploadIcon /> Upload skill
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
            key={s.id}
            icon={<SkillIcon color={colorOf(s.category)} />}
            title={s.title || s.name}
            subtitle={<span className="font-mono">/{s.name}</span>}
            meta={`Updated ${dayjs(s.updated_at).fromNow()}`}
            onOpen={() => open(s.id)}
          >
            <span className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{plain(s.description)}</span>
            <SkillTags skill={s} color={colorOf(s.category)} />
          </LibraryItem>
        ))}
      </LibraryItems>
      <UploadSkillDialog
        open={uploading}
        onOpenChange={setUploading}
        categories={values(all?.categories)}
        sources={values(all?.sources)}
        onUploaded={(s) => open(s.id)}
      />
    </LibraryPage>
  );
}

/** A nav section of categories or sources with their counts, each with its
 *  colour when there is colorOf; choosing the chosen one again clears it. */
function FacetNav({
  label,
  facets = [],
  chosen,
  colorOf,
  onChoose,
}: {
  label: string;
  facets?: Facet[];
  chosen?: string;
  colorOf?: (value: string) => Color;
  onChoose: (value?: string) => void;
}) {
  return (
    <NavSection label={label}>
      {facets.length === 0 && <span className="px-2.5 text-xs text-muted-foreground">None yet</span>}
      {facets.map((f) => (
        <NavItem
          key={f.value}
          icon={colorOf && <span className={cn("size-2 shrink-0 rounded-full", colorOf(f.value).dot)} />}
          label={f.value}
          count={f.count}
          active={chosen === f.value}
          onClick={() => onChoose(chosen === f.value ? undefined : f.value)}
        />
      ))}
    </NavSection>
  );
}

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

/** Markdown as plain text, for a few lines on a card. */
const plain = (md: string) => md.replace(/[*_`#>[\]]/g, "").replace(/\s+/g, " ").trim();
