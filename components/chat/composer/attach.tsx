"use client";

import { Attachment, AttachmentInfo, AttachmentPreview, Attachments } from "@/components/ai-elements/attachments";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { useUploadFile } from "@/lib/api/files";
import { useChatWorkspaceId } from "@/lib/api/workspaces";
import type { Editor } from "@tiptap/react";
import { LoaderIcon, PaperclipIcon } from "lucide-react";
import { type ClipboardEvent, type DragEvent, memo, type RefObject, useRef, useState } from "react";

/** A file on its way to the Files library, shown until it is a chip. */
type Upload = { id: string; name: string; type: string; url: string };

/**
 * Files given to the composer, picked with the paperclip, dropped on it or
 * pasted, go to the conversation's workspace's files (POST /v1/files) and
 * then sit in the text as # chips, as if picked from the # list. Meanwhile
 * each shows above the text; a refused one leaves no chip, and says why.
 * `handlers` go on the composer: in the capture phase, so AI Elements' form
 * doesn't also keep a dropped file in its attachments, which aren't sent.
 */
export function useAttach(editorRef: RefObject<Editor | null>) {
  const upload = useUploadFile();
  const workspaceId = useChatWorkspaceId();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const add = (files: File[]) => {
    setErrors([]);
    for (const file of files) {
      const u = { id: crypto.randomUUID(), name: file.name, type: file.type, url: URL.createObjectURL(file) };
      setUploads((all) => [...all, u]);
      // mutateAsync: mutate's own callbacks fire for the last call only
      upload
        .mutateAsync({ file, workspaceId })
        .then((f) =>
          editorRef.current
            ?.chain()
            .focus()
            .insertContent([
              { type: "reference", attrs: { id: f.id, label: f.name, mentionSuggestionChar: "#" } },
              { type: "text", text: " " },
            ])
            .run(),
        )
        .catch((e: Error) => setErrors((all) => [...all, `${file.name}: ${e.message}`]))
        .finally(() => {
          URL.revokeObjectURL(u.url);
          setUploads((all) => all.filter((x) => x !== u));
        });
    }
  };

  const handlers = {
    onDragOver: (e: DragEvent) => e.dataTransfer.types.includes("Files") && e.preventDefault(),
    onDropCapture: (e: DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      e.stopPropagation();
      add(Array.from(e.dataTransfer.files));
    },
    onPasteCapture: (e: ClipboardEvent) => {
      if (!e.clipboardData.files.length) return; // text pastes as text
      e.preventDefault();
      e.stopPropagation();
      add(Array.from(e.clipboardData.files));
    },
  };
  return { add, uploads, errors, handlers };
}

/** The paperclip: pick files to attach. */
export function AttachButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <PromptInputButton tooltip="Attach files" aria-label="Attach files" onClick={() => input.current?.click()}>
        <PaperclipIcon className="size-4" />
      </PromptInputButton>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = ""; // the same file can be picked again
        }}
      />
    </>
  );
}

/** The files still uploading, each with its preview and a spinner, and why
 *  any was refused. */
export const Uploads = memo(function Uploads({ uploads, errors }: { uploads: Upload[]; errors: string[] }) {
  if (uploads.length === 0 && errors.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-1.5 px-5 pt-4" aria-live="polite">
      {uploads.length > 0 && (
        <Attachments variant="inline">
          {uploads.map((u) => (
            <Attachment
              key={u.id}
              data={{ id: u.id, type: "file", url: u.url, mediaType: u.type, filename: u.name }}
              title={`Uploading ${u.name}`}
              className="cursor-default"
            >
              <AttachmentPreview />
              <AttachmentInfo className="max-w-48" />
              <LoaderIcon className="size-3 animate-spin text-muted-foreground" aria-label="Uploading" />
            </Attachment>
          ))}
        </Attachments>
      )}
      {errors.map((e) => (
        <p key={e} role="alert" className="text-xs text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
});
