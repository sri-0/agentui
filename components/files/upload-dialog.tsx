"use client";

import { VisibilityField } from "@/components/common/visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WorkspaceAvatar } from "@/components/workspaces/workspace-avatar";
import { WorkspaceCommand } from "@/components/workspaces/workspace-command";
import { type UserFile, useFiles, useUploadFile } from "@/lib/api/files";
import { useWorkspaces } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronsUpDownIcon, FolderIcon, LoaderIcon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { FileKindIcon, formatSize } from "./file-icon";

/** The server's limit per file (agentlite docs/FILES.md). */
const MAX_BYTES = 25 << 20;
const MAX_TAGS = 10;
const MAX_TAG = 40;

/** What the server takes: only what a model or the embedding model reads as
 *  it is, nothing converted (agentlite docs/FILES.md). Code is text; browsers
 *  give most code files no type (or .ts a video one), so extensions count. */
const ACCEPT: Record<string, string[]> = {
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
/** ACCEPT as the file input's accept attribute. */
const ACCEPT_ATTR = Object.entries(ACCEPT).flat(2).join(",");

type Entry = { file: File; state: "ready" | "uploading" | "failed"; error?: string };

/**
  * Upload files: drop or pick several, choose their workspace (workspaceId to
 * start; null is none) and who sees them (the uploader alone, to start), tag
 * them all, upload. From a chat (chatWorkspaceId
 * set), each kept file in the chat's workspace goes to onUploaded straight
 * away; files sent to another workspace can't be used there, which it says
 * instead. One the server refuses stays listed with its reason, to remove or
 * retry. The parent mounts it while open, so every batch starts afresh.
 */
export function UploadDialog({
  workspaceId,
  chatWorkspaceId,
  initialFiles = [],
  onUploaded,
  onClose,
}: {
  workspaceId: string | null;
  chatWorkspaceId?: string | null;
  initialFiles?: File[];
  onUploaded?: (files: UserFile[]) => void;
  onClose: () => void;
}) {
  const { data: workspaces = [] } = useWorkspaces();
  const [target, setTarget] = useState(workspaceId);
  const [picking, setPicking] = useState(false); // the workspace list is open
  const picked = workspaces.find((w) => w.id === target);
  const nameOf = (id: string | null) => workspaces.find((w) => w.id === id)?.name ?? "No workspace";
  const elsewhere = chatWorkspaceId !== undefined && target !== chatWorkspaceId;
  const [notice, setNotice] = useState<string>(); // uploaded elsewhere: said instead of chips
  const known = useKnownTags();
  const upload = useUploadFile();
  const [{ entries, refused }, setPicked] = useState(() => pick(initialFiles));
    const [tags, setTags] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const busy = entries.some((e) => e.state === "uploading");

  const browse = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const add = (files: File[]) =>
    setPicked((p) => {
      const next = pick(files);
      const fresh = next.entries.filter((n) => !p.entries.some((e) => same(e.file, n.file)));
      return { entries: [...p.entries, ...fresh], refused: next.refused };
    });
  const set = (file: File, entry: Partial<Entry>) =>
    setPicked((p) => ({ ...p, entries: p.entries.map((e) => (e.file === file ? { ...e, ...entry } : e)) }));

  const start = async () => {
    const todo = entries.filter((e) => e.state !== "uploading");
    for (const { file } of todo) set(file, { state: "uploading", error: undefined });
    const results = await Promise.all(
      todo.map(({ file }) =>
                upload.mutateAsync({ file, workspaceId: target, tags, shared }).then(
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
    if (kept.length && !elsewhere) onUploaded?.(kept);
    if (kept.length < todo.length) return; // the refused ones stay listed
    if (elsewhere) setNotice(`Uploaded to ${nameOf(target)}; files in another workspace can't be used in this chat.`);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>Chats in the workspace can name them with #.</DialogDescription>
        </DialogHeader>

        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium" id="upload-workspace">
                Workspace
              </span>
              {/* shadcn's combobox: pick a workspace, or type a new one's name to create it. */}
              <Popover modal open={picking} onOpenChange={setPicking}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={picking}
                    aria-labelledby="upload-workspace"
                    disabled={busy}
                    className="w-full justify-between font-normal"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {picked ? (
                        <WorkspaceAvatar workspace={picked} size="sm" />
                      ) : (
                        <FolderIcon className="text-muted-foreground" />
                      )}
                      <span className="truncate">{nameOf(target)}</span>
                    </span>
                    <ChevronsUpDownIcon className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
                  <WorkspaceCommand
                    workspaces={workspaces}
                    currentId={target}
                    onChoose={(id) => {
                      setTarget(id);
                      setPicking(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
                            {elsewhere && (
                <p className="text-xs text-muted-foreground">
                  Files in another workspace can&apos;t be used in this chat; they won&apos;t be added to your message.
                </p>
              )}
            </div>

            <VisibilityField value={shared} onChange={setShared} disabled={busy} label="Who can see them" />


            <button
              type="button"
              disabled={busy}
              onClick={() => browse.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                add([...e.dataTransfer.files]);
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors hover:bg-accent/40 disabled:opacity-60",
                dragging && "border-primary/60 bg-accent/60",
              )}
            >
              <UploadIcon className="size-5 text-muted-foreground" />
              <span className="text-sm font-medium">{dragging ? "Drop them here" : "Drop files here or browse"}</span>
              <span className="text-xs text-muted-foreground">Text & code, PNG, JPEG, WebP, GIF, WAV, MP3, MP4, PDF · up to 25 MB each</span>
            </button>
            <input
              ref={browse}
              type="file"
              multiple
              hidden
              accept={ACCEPT_ATTR}
              aria-label="Choose files"
              onChange={(e) => {
                add([...(e.target.files ?? [])]);
                e.target.value = ""; // the same file can be picked again
              }}
            />

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
              <TagsField tags={tags} onChange={setTags} disabled={busy} />
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

          </>
        )}

        <DialogFooter>
          {notice ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={start} disabled={busy || entries.length === 0}>
                {busy ? <LoaderIcon className="animate-spin" /> : <CheckIcon />}
                {entries.some((e) => e.state === "failed") ? "Try again" : `Upload ${entries.length || ""}`.trim()}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Picked files as entries, and why any were refused, in words. */
function pick(files: File[]) {
  const okay = files.filter((f) => f.size <= MAX_BYTES && accepts(f));
  const refused = files
    .filter((f) => !okay.includes(f))
    .map((f) => `${f.name}: ${f.size > MAX_BYTES ? "over 25 MB" : "not a kind of file that can be uploaded"}`);
  return { entries: okay.map((file): Entry => ({ file, state: "ready" })), refused };
}

/** The same file picked twice. */
const same = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/** Whether a file is one ACCEPT lets through, by type or extension. */
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

/**
 * Tags as chips before a text box: Enter, a comma or leaving the box adds what
 * is typed; Backspace in an empty box removes the last; ✕ removes one. As the
 * server takes them: at most 10, each at most 40 characters, no repeat in any
 * case.
 */
function TagsField({ tags, onChange, disabled }: { tags: string[]; onChange: (tags: string[]) => void; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const add = (words: string[]) => {
    const next = [...tags];
    for (const w of words.map((w) => w.trim())) {
      if (w && w.length <= MAX_TAG && next.length < MAX_TAGS && !next.some((t) => t.toLowerCase() === w.toLowerCase())) next.push(w);
    }
    if (next.length !== tags.length) onChange(next);
  };
  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-transparent px-2 py-1 focus-within:ring-3 focus-within:ring-ring/50">
      {tags.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1 pe-1">
          {t}
          <button
            type="button"
            aria-label={`Remove tag ${t}`}
            disabled={disabled}
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="rounded-sm opacity-60 hover:opacity-100"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        aria-labelledby="upload-tags"
        value={draft}
        disabled={disabled || tags.length >= MAX_TAGS}
        placeholder={tags.length ? "" : "Type a tag, then Enter"}
        className="h-7 min-w-24 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        onChange={(e) => {
          // a comma, typed or pasted, ends a tag
          const parts = e.target.value.split(",");
          if (parts.length > 1) add(parts.slice(0, -1));
          setDraft(parts.at(-1) ?? "");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add([draft]);
            setDraft("");
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => {
          add([draft]);
          setDraft("");
        }}
      />
    </div>
  );
}
