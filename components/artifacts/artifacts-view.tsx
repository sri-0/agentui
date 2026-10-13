"use client";

import {
  ArtifactActions,
  ArtifactBody,
  artifactDetails,
  ArtifactIcon,
  EmbeddedPage,
} from "@/components/right-panel/artifact-view";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { type RecentArtifact, useRecentArtifacts } from "@/lib/api/artifacts";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** An artifact id is unique within its conversation only. */
const keyOf = (a: RecentArtifact) => `${a.root_id}/${a.id}`;

/**
 * Every conversation's artifacts in one place, newest first: the list, and
 * the one picked open beside it with a link to its conversation. On a narrow
 * screen the open artifact replaces the list.
 */
export function ArtifactsView() {
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useRecentArtifacts();
  const artifacts = data?.pages.flatMap((p) => p.data) ?? [];
  const [openKey, setOpenKey] = useState<string>();
  const open = artifacts.find((a) => keyOf(a) === openKey);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger className="text-muted-foreground" />
        <h1 className="text-sm font-semibold">Artifacts</h1>
      </header>
      <div className="flex min-h-0 flex-1">
        <section
          aria-label="All artifacts"
          className={cn("w-full overflow-y-auto p-3 md:max-w-sm md:border-r", open && "hidden md:block")}
        >
          {error && <p className="p-3 text-sm text-destructive">{error.message}</p>}
          {isPending && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
          {!isPending && !error && artifacts.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No artifacts yet.</p>
          )}
          <ul className="flex flex-col gap-1">
            {artifacts.map((a) => (
              <li key={keyOf(a)}>
                <button
                  type="button"
                  onClick={() => setOpenKey(keyOf(a))}
                  aria-current={a === open || undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
                    a === open && "bg-accent",
                  )}
                >
                  <ArtifactIcon kind={a.kind} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.thread_title || "Untitled conversation"}
                    </span>
                    <span className="text-xs text-muted-foreground">{artifactDetails(a)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          )}
        </section>
        <section aria-label="Artifact" className={cn("min-w-0 flex-1 flex-col", open ? "flex" : "hidden md:flex")}>
          {open ? (
            // Citations in the body are numbered by the artifact's conversation.
            <ThreadIdContext value={open.root_id}>
              <OpenArtifact key={keyOf(open)} artifact={open} onBack={() => setOpenKey(undefined)} />
            </ThreadIdContext>
          ) : (
            <p className="m-auto text-sm text-muted-foreground">Pick an artifact to open it.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function OpenArtifact({ artifact, onBack }: { artifact: RecentArtifact; onBack: () => void }) {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon-sm" title="All artifacts" className="md:hidden" onClick={onBack}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{artifact.title}</span>
        {/* The conversation, not the sub-agent thread that may have published it. */}
        <Button variant="ghost" size="sm" title="Open conversation" asChild>
          <Link href={`/chat/${artifact.root_id}`}>
            <MessageSquareIcon className="size-4" /> <span className="hidden sm:inline">Open conversation</span>
          </Link>
        </Button>
        <ArtifactActions threadId={artifact.root_id} artifact={artifact} />
      </div>
      {artifact.kind === "url" ? (
        <EmbeddedPage artifact={artifact} />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl">
            <ArtifactBody threadId={artifact.root_id} artifact={artifact} />
          </div>
        </div>
      )}
    </>
  );
}
