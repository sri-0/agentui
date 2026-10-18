"use client";

import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { UploadDialog } from "@/components/files/upload-dialog";
import type { UserFile } from "@/lib/api/files";
import { useChatWorkspaceId } from "@/lib/api/workspaces";
import type { Editor } from "@tiptap/react";
import { PaperclipIcon } from "lucide-react";
import { type ClipboardEvent, type DragEvent, type RefObject, useState } from "react";

/**
 * Files given to the composer: the paperclip, a drop on it or a paste opens
 * the upload dialog (with what was dropped or pasted), which keeps them in
 * the conversation's workspace's files; each kept one goes into the text as
 * a # chip at the cursor, as if picked from the # list. Nothing uploads
 * without the dialog. `handlers` go on the composer: in the capture phase,
 * so AI Elements' form doesn't also keep a dropped file in its attachments,
 * which aren't sent.
 */
export function useAttach(editorRef: RefObject<Editor | null>) {
  const workspaceId = useChatWorkspaceId();
  const [files, setFiles] = useState<File[]>(); // the dialog is open, with these to start

  const insert = (kept: UserFile[]) =>
    editorRef.current
      ?.chain()
      .focus()
      .insertContent(
        kept.flatMap((f) => [
          { type: "reference", attrs: { id: f.id, label: f.name, mentionSuggestionChar: "#" } },
          { type: "text", text: " " },
        ]),
      )
      .run();
  const close = () => {
    setFiles(undefined);
    requestAnimationFrame(() => editorRef.current?.commands.focus()); // after the dialog gives focus back
  };

  const handlers = {
    onDragOver: (e: DragEvent) => e.dataTransfer.types.includes("Files") && e.preventDefault(),
    onDropCapture: (e: DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      e.stopPropagation();
      setFiles(Array.from(e.dataTransfer.files));
    },
    onPasteCapture: (e: ClipboardEvent) => {
      if (!e.clipboardData.files.length) return; // text pastes as text
      e.preventDefault();
      e.stopPropagation();
      setFiles(Array.from(e.clipboardData.files));
    },
  };
  const dialog = files && (
    <UploadDialog workspaceId={workspaceId} initialFiles={files} onUploaded={insert} onClose={close} />
  );
  return { open: () => setFiles([]), handlers, dialog };
}

/** The paperclip: opens the upload dialog. */
export function AttachButton({ onClick }: { onClick: () => void }) {
  return (
    <PromptInputButton tooltip="Attach files" aria-label="Attach files" onClick={onClick}>
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
}
