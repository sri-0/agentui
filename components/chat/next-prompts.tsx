"use client";

import { usePromptInputController } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { type SuggestMessage, useSuggestions } from "@/lib/api/suggestions";
import { memo } from "react";

const TYPED_MIN = 3; // characters typed before the suggestions follow the text

/**
 * What the user might send next, above the composer (AI Elements'
 * suggestions): for the thread's last answer while the input is empty, and
 * for what is being typed once there is some. Picking one sends it in place
 * of the draft. Nothing shows while they load or if they fail.
 */
export const NextPrompts = memo(function NextPrompts({
  messageId,
  messages,
  onPick,
  className,
}: {
  messageId?: string;
  messages?: SuggestMessage[];
  onPick: (prompt: string) => void;
  className?: string;
}) {
  const typing = usePromptInputController().textInput.value.trim();
  const text = typing.length >= TYPED_MIN ? typing : undefined;
  const { data: prompts = [] } = useSuggestions({ messageId, messages, text });
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
