"use client";

import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import { SourceSystem } from "@/components/chat/source-details";
import { Button } from "@/components/ui/button";
import { useConnectors } from "@/lib/api/connectors";
import { useListedSource, useSource } from "@/lib/api/sources";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import dayjs from "@/lib/dayjs";
import { useUiStore } from "@/stores/ui-store";
import { useContext } from "react";

/**
 * One or more adjacent [source:N] citations as an AI Elements inline
 * citation: a badge naming the first source (its host, or the system it came
 * from) and how many more, and on hover a card to page through them. The
 * conversation's sources are listed once for every citation; one the list
 * does not have yet (it is refetched when a run ends) is fetched on open.
 */
export function SourceCitation({ numbers }: { numbers: number[] }) {
  const threadId = useContext(ThreadIdContext);
  // Outside a conversation (a skill's description, say) there is no source to show.
  if (!threadId) return <span className="text-muted-foreground">[{numbers.join(", ")}]</span>;
  return <ThreadCitation threadId={threadId} numbers={numbers} />;
}

function ThreadCitation({ threadId, numbers }: { threadId: string; numbers: number[] }) {
  const { data: first } = useListedSource(threadId, numbers[0]);
  const { data: connectors } = useConnectors();
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const name =
    first?.url ?? connectors?.find((c) => c.id === first?.system)?.name ?? first?.system ?? `source ${numbers[0]}`;
  return (
    <InlineCitation>
      <InlineCitationCard>
        <InlineCitationCardTrigger
          data-source={numbers.join(",")}
          sources={numbers.map((n, i) => (i === 0 ? name : String(n)))}
          className="cursor-pointer align-middle text-[10px] font-medium"
        />
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            {numbers.length > 1 && (
              <InlineCitationCarouselHeader>
                <InlineCitationCarouselPrev />
                <InlineCitationCarouselNext />
                <InlineCitationCarouselIndex />
              </InlineCitationCarouselHeader>
            )}
            <InlineCitationCarouselContent>
              {numbers.map((n) => (
                <InlineCitationCarouselItem key={n}>
                  <CitedSource threadId={threadId} number={n} />
                </InlineCitationCarouselItem>
              ))}
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
          <div className="border-t px-4 py-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => openSidepanel({ kind: "sources", number: numbers[0] })}
            >
              All sources
            </Button>
          </div>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

/** One source in the card: its title and address, and where it came from. */
function CitedSource({ threadId, number }: { threadId: string; number: number }) {
  const { data: listed } = useListedSource(threadId, number);
  const fetched = useSource(threadId, number, !listed);
  const s = listed ?? fetched.data;
  if (!listed && fetched.error) return <p className="text-sm text-destructive">{fetched.error.message}</p>;
  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <InlineCitationSource title={`${number}. ${s.title || s.url || "Untitled"}`} url={s.url}>
      <p className="text-xs text-muted-foreground">
        <SourceSystem system={s.system} iconClassName="size-3" /> · {s.tool} · retrieved {dayjs(s.retrieved_at).fromNow()}
      </p>
      {s.url && (
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
          Open
        </a>
      )}
    </InlineCitationSource>
  );
}
