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
  duration,
}: {
  text: string;
  isStreaming: boolean;
  /** Persisted thinking duration in SECONDS (from the reasoning part timing), so
   *  a reloaded message shows the real "Thought for N seconds". Undefined when
   *  unknown (live streaming falls back to client-side timing in <Reasoning>). */
  duration?: number;
}) {
  return (
    <Reasoning isStreaming={isStreaming} className="w-full" duration={duration}>
      <ReasoningTrigger />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  );
});
