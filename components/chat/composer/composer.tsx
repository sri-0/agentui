"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";
import { memo, type ReactNode, useCallback, useRef, useState } from "react";

import { AgentSelector } from "./agent-selector";
import { AttachButton, Uploads, useAttach } from "./attach";
import { ConnectorSelector } from "./connector-selector";
import { ModelSelector } from "./model-selector";
import { ReferenceInput } from "./references";
import { DictationBar, VoiceButton } from "./voice";

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

// The provider holds the text the form sends; the editor writes it on each edit.
export const Composer = memo(function Composer(props: ComposerProps) {
  return (
    <PromptInputProvider initialInput={props.initialText}>
      <ComposerInput {...props} />
    </PromptInputProvider>
  );
});

function ComposerInput({ onSubmit, status, onStop, contextSlot, autoFocus, placeholder }: ComposerProps) {
  const idle = status === "ready";
  const editorRef = useRef<Editor | null>(null); // the voice prompt writes into it
  const [dictating, setDictating] = useState(false);
  const [voiceError, setVoiceError] = useState<string>();
  const attach = useAttach(editorRef);
  const uploading = attach.uploads.length > 0;
  // A chip that reads as nothing (an agent) can leave a space behind. Sending
  // waits for the files being attached: refused, the text stays.
  const submit = useCallback(
    (message: PromptInputMessage) =>
      uploading ? Promise.reject(new Error("files uploading")) : onSubmit({ ...message, text: message.text.trim() }),
    [onSubmit, uploading],
  );
  const startDictation = useCallback(() => {
    setVoiceError(undefined);
    setDictating(true);
  }, []);
  const endDictation = useCallback((error?: string) => {
    setVoiceError(error);
    setDictating(false);
  }, []);

  return (
    <div className="relative" {...attach.handlers}>
      <div className="ai-glow" />
      <PromptInput
        onSubmit={submit}
        className={cn(
          "relative z-[1] border-0 bg-transparent shadow-none",
          // single, soft, glassy container on the inner InputGroup (kills the double border)
          "[&_[data-slot=input-group]]:rounded-[26px] [&_[data-slot=input-group]]:border [&_[data-slot=input-group]]:border-border/70",
          "[&_[data-slot=input-group]]:bg-card/80 [&_[data-slot=input-group]]:shadow-xl [&_[data-slot=input-group]]:shadow-black/10 [&_[data-slot=input-group]]:backdrop-blur-xl",
          "[&_[data-slot=input-group]]:transition-colors [&_[data-slot=input-group]]:has-[.ProseMirror-focused]:border-border",
        )}
      >
        <PromptInputBody>
          <Uploads uploads={attach.uploads} errors={attach.errors} />
          <ReferenceInput
            autoFocus={autoFocus}
            placeholder={placeholder ?? "Ask anything, or pick an agent…"}
            editorRef={editorRef}
          />
        </PromptInputBody>
        <PromptInputFooter className="flex-wrap gap-3 px-3 pb-3 pt-1">
          {dictating ? (
            <DictationBar editorRef={editorRef} onEnd={endDictation} />
          ) : (
            <>
              <PromptInputTools className="flex-wrap gap-1">
                <AttachButton onFiles={attach.add} />
                <ModelSelector />
                <AgentSelector />
                <ConnectorSelector />
              </PromptInputTools>
              <div className="flex items-center gap-2">
                {contextSlot}
                <VoiceButton error={voiceError} onStart={startDictation} />
                <PromptInputSubmit
                  status={status}
                  onStop={onStop}
                  // aria, not disabled: a disabled control fades the whole input group
                  aria-disabled={(idle && uploading) || undefined}
                  className={cn(
                    "size-9 rounded-full border-0 aria-disabled:opacity-50",
                    idle && "ai-gradient-strong text-white hover:opacity-90",
                  )}
                />
              </div>
            </>
          )}
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
