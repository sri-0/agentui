"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTools,
  type PromptInputMessage,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";
import { memo, type ReactNode, useCallback, useRef, useState } from "react";

import { AgentSelector } from "./agent-selector";
import { AttachButton, useAttach } from "./attach";
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
  /** an images composer: it picks the image model, and no agent or connectors */
  images?: boolean;
  /** shown above the input while it is empty, e.g. next-prompt suggestions */
  above?: ReactNode;
};

// The provider holds the text the form sends; the editor writes it on each edit.
export const Composer = memo(function Composer(props: ComposerProps) {
  return (
    <PromptInputProvider initialInput={props.initialText}>
      <ComposerInput {...props} />
    </PromptInputProvider>
  );
});

function ComposerInput({ onSubmit, status, onStop, contextSlot, autoFocus, placeholder, images, above }: ComposerProps) {
  const idle = status === "ready";
  const editorRef = useRef<Editor | null>(null); // the voice prompt writes into it
  const [dictating, setDictating] = useState(false);
  const [voiceError, setVoiceError] = useState<string>();
  const attach = useAttach(editorRef);
  // A chip that reads as nothing (an agent) can leave a space behind.
  const submit = useCallback(
    (message: PromptInputMessage) => onSubmit({ ...message, text: message.text.trim() }),
    [onSubmit],
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
    <>
      {above && <WhileEmpty>{above}</WhileEmpty>}
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
            // a file held over the composer: the drop opens the upload dialog
            attach.dragging && "[&_[data-slot=input-group]]:border-primary/60 [&_[data-slot=input-group]]:ring-4 [&_[data-slot=input-group]]:ring-primary/10",
          )}
        >
          <PromptInputBody>
            <ReferenceInput
              autoFocus={autoFocus}
              placeholder={placeholder ?? "Ask anything · / skills · @ agents · # files"}
              editorRef={editorRef}
            />
          </PromptInputBody>
          <PromptInputFooter className="gap-3 px-3 pb-3 pt-1">
            {dictating ? (
              <DictationBar editorRef={editorRef} onEnd={endDictation} />
            ) : (
              <>
                {/* one row: on a narrow screen the selectors scroll, send stays put */}
                <PromptInputTools className="min-w-0 flex-1 gap-1 overflow-x-auto py-0.5 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none]">
                  {images ? (
                    <ModelSelector use="image" />
                  ) : (
                    <>
                      <AttachButton onClick={attach.open} />
                      <ModelSelector />
                      <AgentSelector />
                      <ConnectorSelector />
                    </>
                  )}
                </PromptInputTools>
                <div className="flex shrink-0 items-center gap-2">
                  {contextSlot}
                  <VoiceButton error={voiceError} onStart={startDictation} />
                  <PromptInputSubmit
                    status={status}
                    onStop={onStop}
                    className={cn("size-9 rounded-full border-0", idle && "ai-gradient-strong text-white hover:opacity-90")}
                  />
                </div>
              </>
            )}
          </PromptInputFooter>
        </PromptInput>
      </div>
      {/* outside the drop and paste handlers: React events bubble out of a portal */}
      {attach.dialog}
    </>
  );
}

/** Its children while the input is empty: typing puts them away. Apart from
 *  ComposerInput, so a keystroke re-renders only this. */
function WhileEmpty({ children }: { children: ReactNode }) {
  const { textInput } = usePromptInputController();
  return textInput.value.trim() ? null : children;
}
