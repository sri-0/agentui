"use client";

import { ConnectorIcon } from "@/components/chat/composer/connector-icon";
import { SourceMetadata, SourceSystem } from "@/components/chat/source-details";
import { LibraryItem, LibraryItems } from "@/components/library/library";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useConnectors } from "@/lib/api/connectors";
import { type RecentSource, useRecentSources } from "@/lib/api/sources";
import dayjs from "@/lib/dayjs";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

/**
 * A workspace's sources, newest first, as cards (or rows): the ones its
 * answers cite, or all that its tools retrieved. search matches the title,
 * address, system and conversation. A source opens its conversation; one with
 * an address opens that in a new tab from its corner.
 */
export function SourceList({ workspaceId, search }: { workspaceId: string; search: string }) {
  const [cited, setCited] = useState(true);
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useRecentSources({
    cited,
    workspace: workspaceId,
  });
  const sources = data?.pages.flatMap((p) => p.data) ?? [];
  const q = search.trim().toLowerCase();
  const shown = sources.filter(
    (s) => !q || [s.title, s.url, s.system, s.thread_title].some((v) => v?.toLowerCase().includes(q)),
  );

  return (
    <>
      <ToggleGroup
        type="single"
        size="sm"
        aria-label="Which sources"
        value={cited ? "cited" : "all"}
        onValueChange={(v) => v && setCited(v === "cited")}
        className="self-start"
      >
        <ToggleGroupItem value="cited">Cited</ToggleGroupItem>
        <ToggleGroupItem value="all">All retrieved</ToggleGroupItem>
      </ToggleGroup>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isPending && !error && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {sources.length
            ? "Nothing matches."
            : cited
              ? "No sources cited yet. Answers cite what their tools find, such as search results and pages read."
              : "No sources yet."}
        </p>
      )}
      <LibraryItems>
        {shown.map((s) => (
          <SourceItem key={s.id} source={s} />
        ))}
      </LibraryItems>
      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </>
  );
}

/** One source: its system's icon, title and conversation; the card adds the
 *  system, the tool and the metadata recorded with it. */
function SourceItem({ source: s }: { source: RecentSource }) {
  const { data: connectors } = useConnectors();
  const cites = s.cited_in?.length ?? 0;
  return (
    <LibraryItem
      href={`/chat/${s.root_id}`}
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
          <ConnectorIcon name={connectors?.find((c) => c.id === s.system)?.icon} className="size-4" />
        </span>
      }
      title={s.title || s.url || "Untitled"}
      subtitle={s.thread_title || "Untitled conversation"}
      meta={`${dayjs(s.retrieved_at).fromNow()}${cites ? ` · cited ${cites === 1 ? "once" : `${cites} times`}` : ""}`}
      actions={
        s.url && (
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.url} aria-label={`Open ${s.url}`}>
              <ExternalLinkIcon />
            </a>
          </Button>
        )
      }
    >
      <p className="truncate text-xs text-muted-foreground">
        <SourceSystem system={s.system} iconClassName="size-3" /> · {s.tool}
      </p>
      <SourceMetadata metadata={s.metadata} />
    </LibraryItem>
  );
}
