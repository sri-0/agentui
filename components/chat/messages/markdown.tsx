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

/** Markdown with [source:N] citations shown as source chips. */
export const Markdown = memo(function Markdown({
  children,
  ...props
}: Omit<MessageResponseProps, "children"> & { children: string }) {
  return (
    <MessageResponse allowedTags={allowedTags} components={components} {...props}>
      {children.replace(CITATION, '<sourceref n="$1"></sourceref>')}
    </MessageResponse>
  );
});
