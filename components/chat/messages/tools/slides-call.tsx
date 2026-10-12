"use client";

import { Button } from "@/components/ui/button";
import type { ToolPart } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { AlertCircleIcon, CheckIcon, LoaderIcon, PresentationIcon } from "lucide-react";
import { memo, useEffect, useRef } from "react";

type Deck = { deck_id?: string; title?: string };

/** The deck a slides call is about: from its input and, once done, its
 *  result (an MCP tool's structured result arrives under `output`). */
function deckOf(part: ToolPart): Deck {
  const input = (part.input ?? {}) as Deck;
  const result = (part.output as { output?: Deck } | undefined)?.output ?? {};
  return { ...input, ...result };
}

const LABELS: Record<string, { running: string; done: string }> = {
  deck_create: { running: "Creating a slide deck", done: "Created a slide deck" },
  deck_write: { running: "Writing slides", done: "Wrote slides" },
  deck_preview_url: { running: "Opening the deck", done: "Opened the deck" },
};

/**
 * A call to one of open-slide's tools (mcp.yaml `ui: slides`). When the run
 * creates a deck or asks for its preview, the artifact panel opens on the
 * deck's live preview; when it writes slides, the preview reloads. A call
 * that was already finished when it mounted (history) does neither. Memoized
 * on the part, like every part renderer.
 */
export const SlidesCall = memo(function SlidesCall({ part }: { part: ToolPart }) {
  const { deck_id: deckId, title } = deckOf(part);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const refreshArtifact = useUiStore((s) => s.refreshArtifact);
  const live = useRef(part.state === "running");

  useEffect(() => {
    if (!live.current || part.state !== "done" || !deckId) return;
    live.current = false;
    if (part.toolName === "deck_write") refreshArtifact(deckId);
    else if (part.toolName === "deck_create" || part.toolName === "deck_preview_url") {
      openSidepanel({ kind: "artifact", artifactId: deckId });
    }
  }, [part.state, part.toolName, deckId, openSidepanel, refreshArtifact]);

  const label = LABELS[part.toolName] ?? { running: part.toolName, done: part.toolName };
  return (
    <div className="my-0.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted-foreground">
      <PresentationIcon className="size-3.5 shrink-0" />
      <span className="shrink-0 text-xs text-foreground">{part.state === "running" ? label.running : label.done}</span>
      {title && <span className="min-w-0 truncate text-xs">{title}</span>}
      {part.state === "running" && <LoaderIcon className="size-3.5 shrink-0 animate-spin" />}
      {part.state === "done" && <CheckIcon className="size-3.5 shrink-0 text-emerald-500" />}
      {part.state === "error" && (
        <span className="flex min-w-0 items-center gap-1 text-xs text-destructive">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          <span className="truncate">{part.errorText}</span>
        </span>
      )}
      {deckId && part.state === "done" && (
        <Button
          variant="link"
          size="sm"
          className="ml-auto h-auto p-0 text-xs"
          aria-label={`Open ${title ?? "the deck"}`}
          onClick={() => openSidepanel({ kind: "artifact", artifactId: deckId })}
        >
          Open
        </Button>
      )}
    </div>
  );
});
