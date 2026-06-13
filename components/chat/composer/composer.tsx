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
import { GhostIcon, PaperclipIcon, XIcon } from "lucide-react";

import { AgentSelector } from "./agent-selector";
import { ContextCircle } from "./context-circle";
import { ModelSelector } from "./model-selector";
import { ReasoningEffortSelector } from "./reasoning-effort-selector";

function AttachmentButton() {
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
}

function AttachmentChips() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-5 pt-4">
      {attachments.files.map((f) => (
        <span
          key={f.id}
          className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-2.5 pr-1 text-xs"
        >
          <span className="max-w-[160px] truncate">{f.filename}</span>
          <button
            type="button"
            onClick={() => attachments.remove(f.id)}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function TemporaryToggle() {
  const temporary = useUiStore((s) => s.temporary);
  const setTemporary = useUiStore((s) => s.setTemporary);
  return (
    <PromptInputButton
      tooltip={temporary ? "Temporary chat is on" : "Temporary chat"}
      onClick={() => setTemporary(!temporary)}
      className={cn(
        "size-9 rounded-full text-muted-foreground hover:bg-accent",
        temporary && "bg-accent text-[var(--ai-from)]",
      )}
    >
      <GhostIcon className="size-4" />
    </PromptInputButton>
  );
}

export function Composer({
  onSubmit,
  status,
  onStop,
  usage,
  onOpenUsage,
  autoFocus,
  glow = true,
}: {
  onSubmit: (message: PromptInputMessage) => void;
  status: ChatStatus;
  onStop: () => void;
  usage: { used: number; total: number; cost?: number };
  onOpenUsage: () => void;
  autoFocus?: boolean;
  glow?: boolean;
}) {
  const temporary = useUiStore((s) => s.temporary);
  const idle = status === "ready" || status === "error";

  return (
    <div className="relative">
      {glow && <div className="ai-glow" />}
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
        multiple
        globalDrop
      >
        <AttachmentChips />
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
            <TemporaryToggle />
          </PromptInputTools>
          <div className="flex items-center gap-2">
            <ContextCircle
              used={usage.used}
              total={usage.total}
              cost={usage.cost}
              onClick={onOpenUsage}
            />
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
}
