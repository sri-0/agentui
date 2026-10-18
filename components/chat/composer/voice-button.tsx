"use client";

import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/client";
import { transcribe } from "@/lib/api/voice";
import type { Editor } from "@tiptap/react";
import { memo, type RefObject, useState } from "react";

/**
 * The voice prompt: records, has the server transcribe it, and appends the
 * text to the composer, to be read over and sent as if typed. It always
 * records (the browser's own speech recognition needs its vendor's servers).
 */
export const VoiceButton = memo(function VoiceButton({ editorRef }: { editorRef: RefObject<Editor | null> }) {
  const [error, setError] = useState<string>();

  const onAudioRecorded = async (recording: Blob) => {
    setError(undefined);
    try {
      const text = await transcribe(recording);
      if (!text) setError("Nothing was heard");
      return text;
    } catch (err) {
      const off = err instanceof ApiError && err.status === 404;
      setError(off ? "The voice prompt is off on this server" : `Couldn't transcribe: ${(err as Error).message}`);
      return "";
    }
  };

  // A text node, so dictated markup ("the <div> tag") stays text.
  const append = (text: string) => {
    const editor = editorRef.current;
    if (!editor || !text) return;
    const before = editor.getText();
    const space = before && !/\s$/.test(before) ? " " : "";
    editor.chain().focus("end").insertContent({ type: "text", text: space + text }).run();
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="max-w-56 truncate text-xs text-destructive" title={error}>
          {error}
        </span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <SpeechInput
              type="button" // inside the composer's form, not a submit
              mode="media-recorder"
              onAudioRecorded={onAudioRecorded}
              onTranscriptionChange={append}
              onRecordingError={() => setError("Couldn't use the microphone")}
              aria-label="Voice prompt"
              className="size-9"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>Speak your prompt</TooltipContent>
      </Tooltip>
    </div>
  );
});
