"use client";

import { usePromptInputController } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useSuggestions } from "@/lib/api/suggestions";
import { memo, useEffect, useState } from "react";

const TYPED_MIN = 3; // characters typed before the suggestions follow the text
const TYPED_DELAY = 500; // ms after the last keystroke

/**
 * What the user might send next, above the composer (AI Elements'
 * suggestions): for the thread's last answer while the input is empty, and
 * for what is being typed once there is some. Picking one sends it in place
 * of the draft. Nothing shows while they load or if they fail.
 */
export const NextPrompts = memo(function NextPrompts({
  threadId,
  messageId,
  onPick,
  className,
}: {
  threadId?: string;
  messageId?: string;
  onPick: (prompt: string) => void;
  className?: string;
}) {
  const typing = usePromptInputController().textInput.value.trim();
  const settled = useDebounced(typing, TYPED_DELAY);
  const text = settled.length >= TYPED_MIN ? settled : undefined;
  const { data: prompts = [] } = useSuggestions({ threadId, messageId, text });
  // With nothing to go on (an empty input outside an answered thread), a
  // previous text's suggestions would linger.
  if (!prompts.length || (!typing && !messageId)) return null;
  return (
    <div className={className}>
      <Suggestions className="px-1 pb-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
        {prompts.map((p) => (
          <Suggestion key={p} suggestion={p} onClick={onPick} className="bg-card/80 font-normal text-muted-foreground" />
        ))}
      </Suggestions>
    </div>
  );
});

/** value, once it has stopped changing for ms. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
