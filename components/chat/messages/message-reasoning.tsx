"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { memo } from "react";

/** Memoized reasoning block — only re-renders when its own text (or streaming
 *  state) changes, so the answer streaming below it doesn't re-render it. */
export const MessageReasoning = memo(function MessageReasoning({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  return (
    <Reasoning isStreaming={isStreaming} className="w-full">
      <ReasoningTrigger />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  );
});
