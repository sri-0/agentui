"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BookOpenIcon, XIcon } from "lucide-react";
import { memo, type ReactNode, useCallback, useState } from "react";

import { AgentSelector } from "./agent-selector";
import { CommandTextarea } from "./command-menu";
import { ConnectorSelector } from "./connector-selector";
import { ModelSelector } from "./model-selector";

/** What the submit button shows; the names the AI Elements input uses. */
export type ComposerStatus = "ready" | "submitted" | "streaming";

type ComposerProps = {
  onSubmit: (message: PromptInputMessage) => void;
  status: ComposerStatus;
  onStop?: () => void;
  // The live token-usage ring, rendered self-subscribing so the composer itself
  // doesn't take a per-token `usage` prop (which would defeat this memo).
  contextSlot?: ReactNode;
  autoFocus?: boolean;
  placeholder?: string;
  /** text the composer starts with, e.g. from a link */
  initialText?: string;
};

// The provider holds the text, so the / and @ palette can follow what is typed.
export const Composer = memo(function Composer(props: ComposerProps) {
  return (
    <PromptInputProvider initialInput={props.initialText}>
      <ComposerInput {...props} />
    </PromptInputProvider>
  );
});

function ComposerInput({ onSubmit, status, onStop, contextSlot, autoFocus, placeholder }: ComposerProps) {
  const idle = status === "ready";
  // The skills the message loads: chips above the text, sent ahead of it as
  // `/name` words, which is what the server resolves (agentlite docs/SKILLS.md).
  const [skills, setSkills] = useState<string[]>([]);
  const submit = useCallback(
    (message: PromptInputMessage) => {
      const text = [...skills.map((name) => `/${name}`), message.text.trim()].filter(Boolean).join(" ");
      onSubmit({ ...message, text });
      setSkills([]);
    },
    [onSubmit, skills],
  );

  return (
    <div className="relative">
      <div className="ai-glow" />
      <PromptInput
        onSubmit={submit}
        className={cn(
          "relative z-[1] border-0 bg-transparent shadow-none",
          // single, soft, glassy container on the inner InputGroup (kills the double border)
          "[&_[data-slot=input-group]]:rounded-[26px] [&_[data-slot=input-group]]:border [&_[data-slot=input-group]]:border-border/70",
          "[&_[data-slot=input-group]]:bg-card/80 [&_[data-slot=input-group]]:shadow-xl [&_[data-slot=input-group]]:shadow-black/10 [&_[data-slot=input-group]]:backdrop-blur-xl",
          "[&_[data-slot=input-group]]:transition-colors [&_[data-slot=input-group]]:has-[textarea:focus]:border-border",
        )}
      >
        {skills.length > 0 && (
          <PromptInputHeader className="px-5 pt-4 pb-0" aria-label="Skills to load">
            {skills.map((name) => (
              <Badge key={name} variant="secondary" className="gap-1 pr-1 font-mono">
                <BookOpenIcon />
                {name}
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => setSkills((s) => s.filter((n) => n !== name))}
                  className="rounded-sm p-0.5 hover:bg-foreground/10"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </PromptInputHeader>
        )}
        <PromptInputBody>
          <CommandTextarea
            skills={skills}
            onSkillsChange={setSkills}
            autoFocus={autoFocus}
            className="max-h-56 min-h-[60px] resize-none border-0 bg-transparent px-6 pt-5 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
            placeholder={placeholder ?? "Ask anything, or pick an agent…"}
          />
        </PromptInputBody>
        <PromptInputFooter className="flex-wrap gap-3 px-3 pb-3 pt-1">
          <PromptInputTools className="flex-wrap gap-1">
            <ModelSelector />
            <AgentSelector />
            <ConnectorSelector />
          </PromptInputTools>
          <div className="flex items-center gap-2">
            {contextSlot}
            <PromptInputSubmit
              status={status}
              onStop={onStop}
              className={cn("size-9 rounded-full border-0", idle && "ai-gradient-strong text-white hover:opacity-90")}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
