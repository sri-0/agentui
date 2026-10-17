"use client";

import { CreatableCombobox } from "@/components/library/creatable-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type Skill, type SkillDetails, useUpdateSkill, useUploadSkill } from "@/lib/api/skills";
import { UploadIcon, XIcon } from "lucide-react";
import { useState } from "react";

const noDetails: SkillDetails = { title: "", description: "", category: "", source: "" };

/** The server's refusal, without its JSON wrapping. */
export function errorMessage(err: Error) {
  try {
    return (JSON.parse(err.message) as { message?: string }).message ?? err.message;
  } catch {
    return err.message;
  }
}

/** The details a skill is filed with; the description is SKILL.md's. */
function DetailsFields({
  details,
  onChange,
  categories,
  sources,
  describe,
}: {
  details: SkillDetails;
  onChange: (d: SkillDetails) => void;
  categories: string[];
  sources: string[];
  describe: string;
}) {
  const set = (k: keyof SkillDetails) => (v: string) => onChange({ ...details, [k]: v });
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="skill-title">Title</Label>
        <Input
          id="skill-title"
          value={details.title}
          onChange={(e) => set("title")(e.target.value)}
          placeholder="Shown on the card; the skill's name if empty"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="skill-description">Description</Label>
        <Textarea
          id="skill-description"
          value={details.description}
          onChange={(e) => set("description")(e.target.value)}
          placeholder={describe}
          rows={4}
        />
        <span className="text-xs text-muted-foreground">Markdown. Agents read it to decide when to use the skill.</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="skill-category">Category</Label>
          <CreatableCombobox
            id="skill-category"
            value={details.category}
            onChange={set("category")}
            options={categories}
            placeholder="Pick or create"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="skill-source">Source</Label>
          <CreatableCombobox
            id="skill-source"
            value={details.source}
            onChange={set("source")}
            options={sources}
            placeholder="e.g. Internal, Open source"
          />
        </div>
      </div>
    </div>
  );
}

/** Upload a skill: drop its zip or SKILL.md, and file it. */
export function UploadSkillDialog({
  open,
  onOpenChange,
  categories,
  sources,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  sources: string[];
  onUploaded: (skill: Skill) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [details, setDetails] = useState(noDetails);
  const [rejected, setRejected] = useState<string>();
  const upload = useUploadSkill();
  const close = (next: boolean) => {
    if (!next) {
      setFiles([]);
      setDetails(noDetails);
      setRejected(undefined);
      upload.reset();
    }
    onOpenChange(next);
  };
  const error = rejected ?? (upload.error && errorMessage(upload.error));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload a skill</DialogTitle>
          <DialogDescription>A zip of the skill&apos;s folder, or its SKILL.md alone.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!files[0]) return;
            upload.mutate(
              { file: files[0], details },
              {
                onSuccess: (s) => {
                  close(false);
                  onUploaded(s);
                },
              },
            );
          }}
        >
          <FileUpload
            value={files}
            onValueChange={(f) => {
              setFiles(f);
              setRejected(undefined);
            }}
            maxFiles={1}
            accept=".zip,.skill,.md"
            onFileValidate={(f) =>
              /\.(zip|skill)$/i.test(f.name) || f.name === "SKILL.md" ? null : "Choose a .zip or a SKILL.md"
            }
            onFileReject={(_, message) => setRejected(message)}
          >
            {files.length === 0 ? (
              <FileUploadDropzone className="flex-col gap-2 py-8">
                <UploadIcon className="size-6 text-muted-foreground" />
                <span className="text-sm font-medium">Drop the skill&apos;s zip or SKILL.md here</span>
                <FileUploadTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    Browse files
                  </Button>
                </FileUploadTrigger>
              </FileUploadDropzone>
            ) : (
              <FileUploadList>
                {files.map((f) => (
                  <FileUploadItem key={f.name} value={f}>
                    <FileUploadItemPreview />
                    <FileUploadItemMetadata />
                    <FileUploadItemDelete asChild>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove">
                        <XIcon className="size-4" />
                      </Button>
                    </FileUploadItemDelete>
                  </FileUploadItem>
                ))}
              </FileUploadList>
            )}
          </FileUpload>
          <DetailsFields
            details={details}
            onChange={setDetails}
            categories={categories}
            sources={sources}
            describe="Leave empty to keep the SKILL.md's description"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!files[0] || upload.isPending}>
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Change a skill's title, description, category or source. */
export function EditSkillDialog({
  skill,
  open,
  onOpenChange,
  categories,
  sources,
}: {
  skill: Skill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  sources: string[];
}) {
  const initial: SkillDetails = {
    title: skill.title ?? "",
    description: skill.description,
    category: skill.category ?? "",
    source: skill.source ?? "",
  };
  const [details, setDetails] = useState(initial);
  const update = useUpdateSkill();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDetails(initial);
        update.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {skill.title || skill.name}</DialogTitle>
          <DialogDescription>Changing the description rewrites the skill&apos;s SKILL.md.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ id: skill.id, details }, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <DetailsFields
            details={details}
            onChange={setDetails}
            categories={categories}
            sources={sources}
            describe="What the skill does and when to use it"
          />
          {update.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(update.error)}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={update.isPending || !details.description.trim()}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
