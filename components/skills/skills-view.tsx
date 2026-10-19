"use client";

import {
  LibraryItem,
  LibraryItems,
  LibraryPage,
  LibraryToolbar,
  NavItem,
  NavSection,
} from "@/components/library/library";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Facet, useSkillFacets, useSkills } from "@/lib/api/skills";
import type { Color } from "@/lib/colors";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, LibraryIcon, SparklesIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { UploadSkillDialog } from "./skill-dialogs";
import { SkillIcon, SkillTags } from "./skill-icon";

/** The draft "Create with agent" opens a new chat with. */
const CREATE_PROMPT =
  "Help me create a new skill for the skills library. Ask me what it should do, its category and its source, " +
  "then write it with write_skill.";

/** /skills with the filter given, the empty ones left out. */
const skillsHref = (filter: Record<string, string | undefined>, path = "/skills") => {
  const params = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
  return params.size ? `${path}?${params}` : path;
};

/**
 * The skills library: categories and sources beside the skills they choose,
 * as cards (or rows), searched by name, title or description. The choices are
 * in the URL (?category=&source=), and a skill's page (/skills/<id>) carries
 * them to go back to. Create adds a skill with an agent or from an upload.
 */
export function SkillsView() {
  const params = useSearchParams();
  const router = useRouter();
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
  const { data: all } = useSkills(); // every skill: the total
  const { colorOf } = useSkillFacets(); // the same colours whatever is chosen
  const skills = data?.data ?? [];
  const skillHref = (id: string) => skillsHref({ category, source }, `/skills/${encodeURIComponent(id)}`);

  const nav = (
    <>
      <NavItem
        icon={<LibraryIcon className="text-muted-foreground" />}
        label="All skills"
        count={all?.data.length}
        active={!category && !source}
        href="/skills"
      />
      <FacetNav
        label="Categories"
        facets={data?.categories}
        chosen={category}
        href={(v) => skillsHref({ category: v, source })}
        colorOf={colorOf}
      />
      <FacetNav
        label="Sources"
        facets={data?.sources}
        chosen={source}
        href={(v) => skillsHref({ category, source: v })}
      />
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
              <DropdownMenuItem asChild>
                <Link href={`/chat?prompt=${encodeURIComponent(CREATE_PROMPT)}`}>
                  <SparklesIcon /> Create with agent
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setUploading(true)}>
                <UploadIcon /> Upload skill
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {error && <p className="text-sm text-destructive">{error.message}</p>}
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
            href={skillHref(s.id)}
            icon={<SkillIcon color={colorOf(s.category)} />}
            title={s.title || s.name}
            subtitle={<span className="font-mono">/{s.name}</span>}
            meta={`Updated ${dayjs(s.updated_at).fromNow()}`}
          >
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{plain(s.description)}</p>
            <SkillTags skill={s} color={colorOf(s.category)} />
          </LibraryItem>
        ))}
      </LibraryItems>
      <UploadSkillDialog
        open={uploading}
        onOpenChange={setUploading}
        onUploaded={(s) => router.push(skillHref(s.id))}
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
  href,
  colorOf,
}: {
  label: string;
  facets?: Facet[];
  chosen?: string;
  href: (value?: string) => string;
  colorOf?: (value: string) => Color;
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
          href={href(chosen === f.value ? undefined : f.value)}
        />
      ))}
    </NavSection>
  );
}

/** Markdown as plain text, for a few lines on a card. */
const plain = (md: string) =>
  md
    .replace(/[*_`#>[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
