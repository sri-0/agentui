"use client";

/**
 * Composer file attachments — drag & drop + display.
 *
 * Self-contained on purpose: everything DnD-related lives here so it can be
 * removed without touching composer internals. To disable, delete this file and
 * remove the four references in `composer.tsx` (the `attachmentInputProps`
 * spread, `<AttachmentList />`, `<AttachmentDropOverlay />`, and the
 * `useAttachmentErrors()` hook + `errorNode`).
 *
 * NOTE: backend is intentionally NOT wired — files are held client-side by the
 * AI SDK PromptInput attachment controller (`usePromptInputAttachments`).
 */

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import { UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Whitelist ───────────────────────────────────────────────────────────────
// Only images and common documents. `image/*` covers png/jpeg/webp/gif/…;
// documents are listed by exact MIME type.
export const ACCEPTED_FILE_TYPES = [
  "image/*",
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
] as const;

export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/** Spread onto <PromptInput> to enable accept-filtering, limits, and DnD. */
export const attachmentInputProps = {
  accept: ACCEPTED_FILE_TYPES.join(","),
  multiple: true,
  maxFiles: MAX_FILES,
  maxFileSize: MAX_FILE_SIZE,
} as const;

// ── Inline attachment list (rendered inside the input) ───────────────────────
export function AttachmentList() {
  const { files, remove } = usePromptInputAttachments();
  if (files.length === 0) return null;

  return (
    <div className="px-5 pt-4">
      <Attachments variant="inline">
        {files.map((file) => (
          <Attachment
            key={file.id}
            data={file}
            onRemove={() => remove(file.id)}
          >
            <AttachmentPreview />
            <AttachmentInfo className="max-w-[160px] truncate" />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </div>
  );
}

// ── Drag overlay (visual only; the PromptInput form handles the actual drop) ──
export function AttachmentDropOverlay() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setActive(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const reset = () => {
      depth = 0;
      setActive(false);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", reset);
    window.addEventListener("dragend", reset);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", reset);
      window.removeEventListener("dragend", reset);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[26px] border-2 border-dashed border-primary/60 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <UploadIcon className="size-4" />
        Drop files to attach
      </div>
    </div>
  );
}

// ── Error feedback (no toast lib; inline transient message) ──────────────────
type AttachmentError = {
  code: "max_files" | "max_file_size" | "accept";
  message: string;
};

const ERROR_MESSAGES: Record<AttachmentError["code"], string> = {
  max_files: `You can attach up to ${MAX_FILES} files.`,
  max_file_size: `Files must be under ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.`,
  accept: "Unsupported file type. Only images and documents are allowed.",
};

export function useAttachmentErrors() {
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onError = useCallback((err: AttachmentError) => {
    setError(ERROR_MESSAGES[err.code] ?? err.message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setError(null), 4000);
  }, []);

  const errorNode = error ? (
    <p className="px-5 pt-3 text-xs text-destructive">{error}</p>
  ) : null;

  return { onError, errorNode };
}
