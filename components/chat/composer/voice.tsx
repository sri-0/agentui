"use client";

import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { ApiError } from "@/lib/api/client";
import { transcribe } from "@/lib/api/voice";
import type { Editor } from "@tiptap/react";
import { ArrowUpIcon, LoaderIcon, MicIcon, SquareIcon, XIcon } from "lucide-react";
import { memo, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Waveform } from "./waveform";

/** The microphone button that starts dictation, with the last one's error beside it. */
export const VoiceButton = memo(function VoiceButton({ error, onStart }: { error?: string; onStart: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="max-w-56 truncate text-xs text-destructive" title={error}>
          {error}
        </span>
      )}
      <PromptInputButton
        tooltip="Speak your prompt"
        aria-label="Voice prompt"
        onClick={onStart}
        className="size-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
      >
        <MicIcon className="size-4" />
      </PromptInputButton>
    </div>
  );
});

/**
 * Dictation, in place of the composer's footer while it runs: the
 * microphone's live waveform, X to drop the recording, stop to have it
 * transcribed into the text, and send to transcribe and send at once. The
 * server transcribes whole recordings, so nothing shows while speaking.
 */
export const DictationBar = memo(function DictationBar({
  editorRef,
  onEnd,
}: {
  editorRef: RefObject<Editor | null>;
  /** called once, when dictation is over; error says why it failed */
  onEnd: (error?: string) => void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const endedRef = useRef(false); // dropped, or the bar is gone: a late transcript is ignored
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const end = useCallback(
    (error?: string) => {
      endedRef.current = true;
      onEnd(error);
    },
    [onEnd],
  );

  // Opens the microphone and records. In development effects run twice: each
  // run closes its own microphone, even one that opens after it was undone.
  useEffect(() => {
    let undone = false;
    endedRef.current = false;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (mic) => {
        if (undone) return void stopTracks(mic);
        const recorder = new MediaRecorder(mic);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        recorder.start();
        recorderRef.current = recorder;
        setStream(mic);
      },
      () => !undone && end("Couldn't use the microphone"),
    );
    return () => {
      undone = true;
      endedRef.current = true;
      if (recorderRef.current) close(recorderRef.current);
      recorderRef.current = null;
    };
  }, [end]);

  const cancel = () => {
    if (recorderRef.current) close(recorderRef.current);
    end();
  };

  const finish = (send: boolean) => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "recording") return end(); // the microphone isn't open yet
    recorder.onstop = async () => {
      stopTracks(recorder.stream);
      let text: string;
      try {
        text = await transcribe(new Blob(chunksRef.current, { type: recorder.mimeType }));
      } catch (err) {
        const off = err instanceof ApiError && err.status === 404;
        if (!endedRef.current) end(off ? "The voice prompt is off on this server" : `Couldn't transcribe: ${(err as Error).message}`);
        return;
      }
      if (endedRef.current) return;
      if (!text) return end("Nothing was heard");
      end();
      insert(editorRef.current, text, send);
    };
    recorder.stop();
    setTranscribing(true);
  };

  return (
    <div className="flex w-full items-center gap-2">
      <PromptInputButton tooltip="Cancel" aria-label="Cancel dictation" onClick={cancel} className="size-9 rounded-full">
        <XIcon className="size-4" />
      </PromptInputButton>
      <div className="relative h-9 min-w-0 flex-1">
        {/* silence, under the bars: a dotted line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dotted border-muted-foreground/25" />
        <Waveform stream={transcribing ? null : stream} className="relative text-muted-foreground" />
      </div>
      <PromptInputButton
        tooltip="Stop and edit"
        aria-label="Stop dictation"
        onClick={() => finish(false)}
        disabled={transcribing}
        className="size-9 rounded-full border border-border"
      >
        {transcribing ? <LoaderIcon className="size-4 animate-spin" /> : <SquareIcon className="size-3.5 fill-current" />}
      </PromptInputButton>
      <PromptInputButton
        tooltip="Send"
        aria-label="Send dictation"
        onClick={() => finish(true)}
        disabled={transcribing}
        className="ai-gradient-strong size-9 rounded-full text-white hover:opacity-90"
      >
        <ArrowUpIcon className="size-4" />
      </PromptInputButton>
    </div>
  );
});

/** Stops a recording and its microphone, keeping nothing. */
function close(recorder: MediaRecorder) {
  recorder.ondataavailable = null;
  recorder.onstop = null;
  if (recorder.state === "recording") recorder.stop();
  stopTracks(recorder.stream);
}

/** Closes a microphone. */
function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

/** Appends a transcript to the composer's text, as a text node so dictated
 *  markup ("the <div> tag") stays text; then sends the form if asked. */
function insert(editor: Editor | null, text: string, send: boolean) {
  if (!editor) return;
  const before = editor.getText();
  const space = before && !/\s$/.test(before) ? " " : "";
  // Committed at once, so the form sends the text with it.
  flushSync(() => editor.chain().focus("end").insertContent({ type: "text", text: space + text }).run());
  if (send) editor.view.dom.closest("form")?.requestSubmit();
}
