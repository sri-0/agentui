"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { ChatStatus } from "ai";
import { PaperclipIcon } from "lucide-react";
import { memo, type ReactNode } from "react";

import { AgentSelector } from "./agent-selector";
import {
  AttachmentDropOverlay,
  AttachmentList,
  attachmentInputProps,
  useAttachmentErrors,
} from "./attachments";
import { ModelSelector } from "./model-selector";
import { ReasoningEffortSelector } from "./reasoning-effort-selector";

const AttachmentButton = memo(function AttachmentButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      tooltip="Attach files for RAG"
      onClick={() => attachments.openFileDialog()}
      className="size-9 rounded-full text-muted-foreground hover:bg-accent"
    >
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
});

export const Composer = memo(function Composer({
  onSubmit,
  status,
  onStop,
  contextSlot,
  autoFocus,
  glow = true,
}: {
  onSubmit: (message: PromptInputMessage) => void;
  status: ChatStatus;
  onStop: () => void;
  // The live token-usage ring, rendered self-subscribing so the composer itself
  // doesn't take a per-token `usage` prop (which would defeat this memo).
  contextSlot?: ReactNode;
  autoFocus?: boolean;
  glow?: boolean;
}) {
  const temporary = useUiStore((s) => s.temporary);
  const idle = status === "ready" || status === "error";
  // File attachments (drag & drop) — see ./attachments.
  const { onError: onAttachmentError, errorNode } = useAttachmentErrors();

  return (
    <div className="relative">
      {glow && <div className="ai-glow" />}
      <AttachmentDropOverlay />
      <PromptInput
        onSubmit={onSubmit}
        className={cn(
          "relative z-[1] border-0 bg-transparent shadow-none",
          // single, soft, glassy container on the inner InputGroup (kills the double border)
          "[&_[data-slot=input-group]]:rounded-[26px] [&_[data-slot=input-group]]:border [&_[data-slot=input-group]]:border-border/70",
          "[&_[data-slot=input-group]]:bg-card/80 [&_[data-slot=input-group]]:shadow-xl [&_[data-slot=input-group]]:shadow-black/10 [&_[data-slot=input-group]]:backdrop-blur-xl",
          "[&_[data-slot=input-group]]:transition-colors [&_[data-slot=input-group]]:has-[textarea:focus]:border-border",
          temporary &&
            "[&_[data-slot=input-group]]:border-dashed [&_[data-slot=input-group]]:border-primary/40",
        )}
        {...attachmentInputProps}
        onError={onAttachmentError}
      >
        {errorNode}
        <AttachmentList />
        <PromptInputBody>
          <PromptInputTextarea
            autoFocus={autoFocus}
            className="max-h-56 min-h-[60px] resize-none border-0 bg-transparent px-6 pt-5 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
            placeholder={
              temporary
                ? "Temporary chat — this won't be saved…"
                : "Ask anything, or pick an agent…"
            }
          />
        </PromptInputBody>
        <PromptInputFooter className="flex-wrap gap-3 px-3 pb-3 pt-1">
          <PromptInputTools className="flex-wrap gap-1">
            <AttachmentButton />
            <ModelSelector />
            <AgentSelector />
            <ReasoningEffortSelector />
          </PromptInputTools>
          <div className="flex items-center gap-2">
            {contextSlot}
            <PromptInputSubmit
              status={status}
              onStop={onStop}
              className={cn(
                "size-9 rounded-full border-0",
                idle && "ai-gradient-strong text-white hover:opacity-90",
              )}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
});
