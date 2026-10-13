"use client";

import { MessageResponse, type MessageResponseProps } from "@/components/ai-elements/message";
import { memo } from "react";
import type { Components } from "streamdown";

import { SourceChip } from "./source-chip";

const CITATION = /\[source:\s*(\d+)\]/g;

// A citation becomes a custom element Streamdown lets through and renders as
// a chip, so it works anywhere inline: lists, tables, headings.
const allowedTags = { sourceref: ["n"] };
const components = {
  sourceref: ({ n }: { n?: string }) => <SourceChip number={Number(n)} />,
} as Components;

/** Markdown with [source:N] citations shown as source chips. `streaming`
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
      {children.replace(CITATION, '<sourceref n="$1"></sourceref>')}
    </MessageResponse>
  );
});
