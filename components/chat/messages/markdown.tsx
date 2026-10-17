"use client";

import { MessageResponse, type MessageResponseProps } from "@/components/ai-elements/message";
import { memo } from "react";
import type { Components } from "streamdown";

import { SourceCitation } from "./source-citation";

/** One [source:N] citation, or several side by side. */
const CITATIONS = /\[source:\s*\d+\](?:\s*\[source:\s*\d+\])*/g;

// Citations become a custom element Streamdown lets through and renders as
// an inline citation, so they work anywhere inline: lists, tables, headings.
const allowedTags = { sourceref: ["n"] };
const components = {
  sourceref: ({ n }: { n?: string }) => <SourceCitation numbers={(n ?? "").split(",").map(Number)} />,
} as Components;

const citations = (text: string) =>
  text.replace(CITATIONS, (run) => `<sourceref n="${run.match(/\d+/g)?.join(",")}"></sourceref>`);

/** Markdown with [source:N] citations shown as AI Elements inline citations. `streaming`
 *  text is repaired as it arrives (an unclosed link or emphasis); finished
 *  text renders as it is. Streamdown applies streaming updates in a
 *  transition, which can leave the last one uncommitted, so a part must stop
 *  streaming once its text is complete. */
export const Markdown = memo(function Markdown({
  children,
  streaming = false,
  ...props
}: Omit<MessageResponseProps, "children" | "mode" | "isAnimating"> & { children: string; streaming?: boolean }) {
  return (
    <MessageResponse
      allowedTags={allowedTags}
      components={components}
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      {...props}
    >
      {citations(children)}
    </MessageResponse>
  );
});
