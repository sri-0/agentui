"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputList } from "@/components/ui/tags-input";
import { type UserFile, useFiles, useUploadFile } from "@/lib/api/files";
import { useWorkspaces } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { CheckIcon, LoaderIcon, UploadIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { type Accept, type FileRejection, useDropzone } from "react-dropzone";

import { FileKindIcon, formatSize } from "./file-icon";

/** The server's limit per file (agentlite docs/FILES.md). */
const MAX_BYTES = 25 << 20;
const MAX_TAGS = 10;
const MAX_TAG = 40;

/** What the server takes: only what a model or the embedding model reads as
 *  it is, nothing converted (agentlite docs/FILES.md). Code is text; browsers
 *  give most code files no type (or .ts a video one), so extensions count. */
const ACCEPT: Accept = {
  "text/*": [
    ...[".txt", ".md", ".csv", ".json", ".log", ".yaml", ".yml", ".toml", ".xml", ".html", ".css", ".sql", ".sh"],
    ...[".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".rb", ".rs", ".c", ".h", ".cpp", ".cs", ".php"],
  ],
  "application/json": [".json"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "audio/wav": [".wav"],
  "audio/mpeg": [".mp3"],
  "video/mp4": [".mp4"],
  "application/pdf": [".pdf"],
};

type Entry = { file: File; state: "ready" | "uploading" | "failed"; error?: string };

/**
 * Upload files into a workspace (null: none): drop or pick several, tag them
 * all, upload. Each one that is kept goes to onUploaded straight away; one the
 * server refuses stays listed with its reason, to remove or retry. The parent
 * mounts it while open, so every batch starts afresh.
 */
export function UploadDialog({
  workspaceId,
  initialFiles = [],
  onUploaded,
  onClose,
}: {
  workspaceId: string | null;
  initialFiles?: File[];
  onUploaded?: (files: UserFile[]) => void;
  onClose: () => void;
}) {
  const { data: workspaces = [] } = useWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId)?.name;
  const known = useKnownTags();
  const upload = useUploadFile();
  const [{ entries, refused }, setPicked] = useState(() => pick(initialFiles, []));
  const [tags, setTags] = useState<string[]>([]);
  const busy = entries.some((e) => e.state === "uploading");

  const add = (accepted: File[], rejections: FileRejection[]) =>
    setPicked((p) => {
      const next = pick(accepted, rejections);
      const fresh = next.entries.filter((n) => !p.entries.some((e) => same(e.file, n.file)));
      return { entries: [...p.entries, ...fresh], refused: next.refused };
    });
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_BYTES,
    multiple: true,
    disabled: busy,
    onDrop: add,
  });
  const set = (file: File, entry: Partial<Entry>) =>
    setPicked((p) => ({ ...p, entries: p.entries.map((e) => (e.file === file ? { ...e, ...entry } : e)) }));

  const start = async () => {
    const todo = entries.filter((e) => e.state !== "uploading");
    for (const { file } of todo) set(file, { state: "uploading", error: undefined });
    const results = await Promise.all(
      todo.map(({ file }) =>
        upload.mutateAsync({ file, workspaceId, tags }).then(
          (record) => {
            setPicked((p) => ({ ...p, entries: p.entries.filter((e) => e.file !== file) }));
            return record;
          },
          (err: Error) => {
            set(file, { state: "failed", error: err.message });
            return null;
          },
        ),
      ),
    );
    const kept = results.filter((r): r is UserFile => r !== null);
    if (kept.length) onUploaded?.(kept);
    if (kept.length === todo.length) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Into {workspace ? <strong className="font-medium text-foreground">{workspace}</strong> : "no workspace"}:
            chats there can name them with #.
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors hover:bg-accent/40",
            isDragActive && "border-primary/60 bg-accent/60",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input {...getInputProps()} aria-label="Choose files" />
          <UploadIcon className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">{isDragActive ? "Drop them here" : "Drop files here, or click to choose"}</p>
          <p className="text-xs text-balance text-muted-foreground">
            Text and code (.txt, .md, .csv, .json, …), images (PNG, JPEG, WebP, GIF), audio (WAV, MP3) and video
            (MP4) are searchable; a PDF can be named with # but not searched. Up to 25 MB each.
          </p>
        </div>

        {refused.length > 0 && (
          <ul role="alert" className="flex flex-col gap-0.5 text-xs text-destructive">
            {refused.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        {entries.length > 0 && (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto" aria-label="Files to upload">
            {entries.map(({ file, state, error }) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
                <FileKindIcon mediaType={file.type} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{file.name}</span>
                  {error && <span className="block text-xs text-destructive">{error}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
                {state === "uploading" ? (
                  <LoaderIcon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Uploading" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setPicked((p) => ({ ...p, entries: p.entries.filter((e) => e.file !== file) }))}
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium" id="upload-tags">
            Tags <span className="font-normal text-muted-foreground">(optional, for all of them)</span>
          </span>
          <TagsInput
            value={tags}
            onValueChange={setTags}
            // as the server takes them: at most 40 characters, no repeat in any case
            onValidate={(t) => t.length <= MAX_TAG && !tags.some((x) => x.toLowerCase() === t.toLowerCase())}
            max={MAX_TAGS}
            addOnPaste
            blurBehavior="add"
            className="w-full"
            aria-labelledby="upload-tags"
          >
            <TagsInputList>
              {tags.map((t) => (
                <TagsInputItem key={t} value={t}>
                  {t}
                </TagsInputItem>
              ))}
              <TagsInputInput placeholder={tags.length ? "" : "Type a tag, then Enter"} disabled={busy} />
            </TagsInputList>
          </TagsInput>
          {known.filter((t) => !tags.includes(t)).length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Used before:
              {known
                .filter((t) => !tags.includes(t))
                .slice(0, 8)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={busy || tags.length >= MAX_TAGS}
                    onClick={() => setTags((ts) => [...ts, t])}
                    className="rounded-md border px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
                  >
                    {t}
                  </button>
                ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={start} disabled={busy || entries.length === 0}>
            {busy ? <LoaderIcon className="animate-spin" /> : <CheckIcon />}
            {entries.some((e) => e.state === "failed") ? "Try again" : `Upload ${entries.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Picked files as entries, and why any were refused, in words. */
function pick(accepted: File[], rejections: FileRejection[]) {
  const okay = accepted.filter((f) => f.size <= MAX_BYTES && accepts(f));
  const refused = [
    ...accepted.filter((f) => !okay.includes(f)).map((f) => f.name),
    ...rejections.map((r) => r.file.name),
  ].map((name) => `${name}: not a kind of file that can be uploaded, or over 25 MB`);
  return { entries: okay.map((file): Entry => ({ file, state: "ready" })), refused };
}

/** The same file picked twice. */
const same = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/** Whether a file passed in from elsewhere (a drop on the composer, a paste)
 *  is one ACCEPT lets through, by type or extension, as the dropzone checks. */
function accepts(file: File) {
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
  return Object.entries(ACCEPT).some(
    ([type, exts]) => (type.endsWith("/*") ? file.type.startsWith(type.slice(0, -1)) : file.type === type) || exts.includes(ext),
  );
}

/** Every tag a file has, most used first, to offer again. */
function useKnownTags() {
  const { data: files = [] } = useFiles();
  const counts = new Map<string, number>();
  for (const t of files.flatMap((f) => f.tags ?? [])) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
