"use client";

import { LibraryItem, LibraryItems, LibraryPage, LibraryToolbar } from "@/components/library/library";
import { Markdown } from "@/components/chat/messages/markdown";
import {
  ARTIFACT_KINDS,
  ArtifactActions,
  ArtifactBody,
  ArtifactIcon,
  EmbeddedPage,
} from "@/components/right-panel/artifact-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type RecentArtifact, useArtifactBody, useRecentArtifacts } from "@/lib/api/artifacts";
import type { Artifact } from "@/lib/chat/types";
import dayjs from "@/lib/dayjs";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { ArrowLeftIcon, MessageSquareIcon } from "lucide-react";
import { useInView } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

/** An artifact id is unique within its conversation only. */
const keyOf = (a: RecentArtifact) => `${a.root_id}/${a.id}`;

/** The kinds the page filters by, as Spaces filters pages from slides; each
 *  tab shows its first kind's icon. */
const KINDS: { label: string; kinds?: Artifact["kind"][] }[] = [
  { label: "All" },
  { label: "Documents", kinds: ["markdown"] },
  { label: "Code", kinds: ["code"] },
  { label: "Data", kinds: ["json", "csv"] },
  { label: "Pages", kinds: ["url"] },
];

/**
 * Every conversation's artifacts, newest first, as cards (or rows) with a
 * preview of each, filtered by kind and searched by title or conversation.
 * Picking one opens it in place of the list (?open=root/id), so the browser's
 * back button returns to the list.
 */
export function ArtifactsView() {
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useRecentArtifacts();
  const artifacts = data?.pages.flatMap((p) => p.data) ?? [];
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState(0);

  const openKey = params.get("open");
  const open = artifacts.find((a) => keyOf(a) === openKey);
  if (open) {
    return (
      <LibraryPage title="Artifacts" fill={open.kind === "url"}>
        <ThreadIdContext value={open.root_id}>
          <OpenArtifact artifact={open} onBack={() => router.push(pathname)} />
        </ThreadIdContext>
      </LibraryPage>
    );
  }

  const q = search.trim().toLowerCase();
  const kinds = KINDS[kind].kinds;
  const shown = artifacts.filter(
    (a) =>
      (!kinds || kinds.includes(a.kind)) &&
      (!q || a.title.toLowerCase().includes(q) || a.thread_title?.toLowerCase().includes(q)),
  );

  return (
    <LibraryPage title="Artifacts">
      <LibraryToolbar heading="Artifacts" search={search} onSearch={setSearch} placeholder="Search artifacts" />
      <div role="group" aria-label="Kind" className="-mt-2 flex flex-wrap gap-1">
        {KINDS.map((k, i) => (
          <Button
            key={k.label}
            variant={i === kind ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={i === kind}
            onClick={() => setKind(i)}
          >
            {k.kinds && <ArtifactIcon kind={k.kinds[0]} />}
            {k.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isPending && !error && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {artifacts.length === 0 ? "No artifacts yet. Ask an agent for a report, a document or a deck." : "Nothing matches."}
        </p>
      )}
      <LibraryItems>
        {shown.map((a) => (
          <LibraryItem
            key={keyOf(a)}
            preview={<ArtifactPreview artifact={a} />}
            icon={
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                <ArtifactIcon kind={a.kind} className="size-4" />
              </span>
            }
            title={a.title}
            subtitle={a.thread_title || "Untitled conversation"}
            meta={a.updated_at ? dayjs(a.updated_at).fromNow() : undefined}
            onOpen={() => router.push(`${pathname}?open=${encodeURIComponent(keyOf(a))}`)}
          />
        ))}
      </LibraryItems>
      {hasNextPage && (
        <Button variant="ghost" size="sm" className="self-center" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </LibraryPage>
  );
}

/** The top of an artifact as a small page, fetched once its card is seen,
 *  with what kind it is; a url artifact shows its address. */
function ArtifactPreview({ artifact }: { artifact: RecentArtifact }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const { body } = useArtifactBody(artifact.root_id, artifact, seen);
  // A card shows no citations: they open cards of their own.
  const text = body?.slice(0, 1200).replace(/\[source:\s*\d+\]/g, "");
  return (
    <span ref={ref} className="relative flex w-full justify-center overflow-hidden px-5 pt-10">
      <span className="w-full overflow-hidden rounded-t-md border border-b-0 bg-background px-3 pt-3 shadow-sm">
        {artifact.kind === "url" ? (
          <span className="flex h-full flex-col items-center justify-center gap-2 pb-6 text-muted-foreground">
            <ArtifactIcon kind="url" className="size-6" />
            <span className="max-w-full truncate text-xs">{hostOf(artifact.url)}</span>
          </span>
        ) : text == null ? (
          <span className="flex flex-col gap-1.5" aria-hidden>
            <span className="h-2 w-2/3 rounded bg-muted" />
            <span className="h-1.5 w-full rounded bg-muted" />
            <span className="h-1.5 w-5/6 rounded bg-muted" />
          </span>
        ) : artifact.kind === "markdown" ? (
          // A page in miniature: rendered at twice the width, then scaled down.
          <span className="pointer-events-none block w-[200%] origin-top-left scale-50 text-xs" aria-hidden>
            <Markdown>{text}</Markdown>
          </span>
        ) : (
          <span className="block font-mono text-[9px] leading-snug whitespace-pre-wrap text-muted-foreground" aria-hidden>
            {text}
          </span>
        )}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/60 to-transparent" />
      <Badge variant="outline" className="absolute top-2 left-2 bg-background/90 shadow-xs">
        <ArtifactIcon kind={artifact.kind} />
        {ARTIFACT_KINDS[artifact.kind]?.label ?? artifact.kind}
      </Badge>
    </span>
  );
}

function hostOf(url?: string) {
  try {
    return new URL(url ?? "").host;
  } catch {
    return url ?? "";
  }
}

/** An artifact opened in place of the list; a url artifact's page takes all
 *  the room there is. */
function OpenArtifact({ artifact, onBack }: { artifact: RecentArtifact; onBack: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon /> Artifacts
        </Button>
        <h1 className="mr-auto min-w-0 truncate text-xl font-semibold">{artifact.title}</h1>
        {/* The conversation, not the sub-agent thread that may have published it. */}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/chat/${artifact.root_id}`}>
            <MessageSquareIcon /> Open thread
          </Link>
        </Button>
        <ArtifactActions threadId={artifact.root_id} artifact={artifact} />
      </div>
      {artifact.kind === "url" ? (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border">
          <EmbeddedPage artifact={artifact} />
        </div>
      ) : (
        <div className="rounded-xl border p-6">
          <ArtifactBody threadId={artifact.root_id} artifact={artifact} />
        </div>
      )}
    </div>
  );
}
