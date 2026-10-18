"use client";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useSuggestions } from "@/lib/api/suggestions";
import { memo } from "react";

/**
 * What the user might send next, above the composer once an answer is in:
 * AI Elements' suggestions, fetched for that answer. Picking one sends it.
 * Nothing shows while they load or if they fail.
 */
export const NextPrompts = memo(function NextPrompts({
  threadId,
  messageId,
  onPick,
}: {
  threadId: string;
  messageId: string;
  onPick: (prompt: string) => void;
}) {
  const { data: prompts = [] } = useSuggestions(threadId, messageId);
  if (!prompts.length) return null;
  return (
    <Suggestions className="px-1 pb-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {prompts.map((p) => (
        <Suggestion key={p} suggestion={p} onClick={onPick} className="bg-card/80 font-normal text-muted-foreground" />
      ))}
    </Suggestions>
  );
});
