"use client";

import { CreatableCombobox } from "@/components/library/creatable-combobox";
import { MarkdownEditor } from "@/components/library/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { type Skill, type SkillDetails, useSkillFacets, useUpdateSkill, useUploadSkill } from "@/lib/api/skills";
import { UploadIcon, XIcon } from "lucide-react";
import { Controller, FormProvider, useForm, useFormContext } from "react-hook-form";

/** The details a skill is filed with, in the form around them. The
 *  description is SKILL.md's: at most 1024 characters, as the Agent Skills
 *  spec has it, and required when editing. */
function DetailsFields({ describe, required }: { describe: string; required?: boolean }) {
  const { control } = useFormContext<SkillDetails>();
  const { categories, sources } = useSkillFacets();
  return (
    <>
      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="skill-title">Title</FieldLabel>
            <Input {...field} id="skill-title" placeholder="Shown on the card; the skill's name if empty" />
          </Field>
        )}
      />
      <Controller
        name="description"
        control={control}
        rules={{
          maxLength: { value: 1024, message: "At most 1024 characters, as the skills spec allows" },
          validate: (v) => !required || v.trim() !== "" || "Say what the skill does and when to use it",
        }}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id="skill-description-label">Description</FieldLabel>
            <MarkdownEditor
              labelledBy="skill-description-label"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={describe}
              invalid={fieldState.invalid}
            />
            <FieldDescription>
              Agents read it to decide when to use the skill. {field.value.length}/1024
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="skill-category">Category</FieldLabel>
              <CreatableCombobox
                id="skill-category"
                value={field.value}
                onChange={field.onChange}
                options={categories}
                placeholder="Pick or create"
              />
            </Field>
          )}
        />
        <Controller
          name="source"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="skill-source">Source</FieldLabel>
              <CreatableCombobox
                id="skill-source"
                value={field.value}
                onChange={field.onChange}
                options={sources}
                placeholder="e.g. Internal, Open source"
              />
            </Field>
          )}
        />
      </div>
    </>
  );
}

/** An upload: the skill's zip or SKILL.md, and its details; an empty
 *  description keeps the SKILL.md's. */
type Upload = SkillDetails & { files: File[] };

/** One file: a skill's zip or its SKILL.md. */
const oneSkillFile = ([f]: File[]) =>
  !f
    ? "Choose the skill's zip or SKILL.md"
    : /\.(zip|skill)$/i.test(f.name) || f.name === "SKILL.md" || "Choose a .zip or a SKILL.md";

/** Upload a skill: drop its zip or SKILL.md, and file it. */
export function UploadSkillDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (skill: Skill) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload a skill</DialogTitle>
          <DialogDescription>A zip of the skill&apos;s folder, or its SKILL.md alone.</DialogDescription>
        </DialogHeader>
        {/* mounted with the dialog, so each opening starts empty */}
        <UploadForm
          onUploaded={(s) => {
            onOpenChange(false);
            onUploaded(s);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({ onUploaded }: { onUploaded: (skill: Skill) => void }) {
  const mutation = useUploadSkill();
  const form = useForm<Upload>({
    defaultValues: { files: [], title: "", description: "", category: "", source: "" },
  });
  return (
    <FormProvider {...form}>
      <form
        className="grid gap-5"
        onSubmit={form.handleSubmit(({ files, ...details }) =>
          mutation.mutate({ file: files[0], details }, { onSuccess: onUploaded }),
        )}
      >
        <FieldGroup>
          <Controller
            name="files"
            control={form.control}
            rules={{ validate: oneSkillFile }}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FileUpload
                  value={field.value}
                  onValueChange={field.onChange}
                  maxFiles={1}
                  accept=".zip,.skill,.md"
                  onFileReject={(_, message) => form.setError("files", { message })}
                >
                  {field.value.length === 0 ? (
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
                      {field.value.map((f) => (
                        <FileUploadItem key={f.name} value={f}>
                          <FileUploadItemPreview />
                          <FileUploadItemMetadata />
                          <FileUploadItemDelete asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove">
                              <XIcon />
                            </Button>
                          </FileUploadItemDelete>
                        </FileUploadItem>
                      ))}
                    </FileUploadList>
                  )}
                </FileUpload>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <DetailsFields describe="Leave empty to keep the SKILL.md's description" />
        </FieldGroup>
        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

/** Change a skill's title, description, category or source. */
export function EditSkillDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: Skill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {skill.title || skill.name}</DialogTitle>
          <DialogDescription>Changing the description rewrites the skill&apos;s SKILL.md.</DialogDescription>
        </DialogHeader>
        {/* mounted with the dialog, so each opening starts from the skill */}
        <EditForm skill={skill} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ skill, onSaved }: { skill: Skill; onSaved: () => void }) {
  const mutation = useUpdateSkill();
  const form = useForm<SkillDetails>({
    defaultValues: {
      title: skill.title ?? "",
      description: skill.description,
      category: skill.category ?? "",
      source: skill.source ?? "",
    },
  });
  // Read while rendering, so the form tracks it (react-hook-form's formState
  // proxy): only what changed is sent, and an untouched description leaves
  // SKILL.md alone.
  const { dirtyFields } = form.formState;
  return (
    <FormProvider {...form}>
      <form
        className="grid gap-5"
        onSubmit={form.handleSubmit((values) => {
          const changed = Object.fromEntries(
            Object.entries(values).filter(([k]) => dirtyFields[k as keyof SkillDetails]),
          );
          if (Object.keys(changed).length === 0) return onSaved();
          mutation.mutate({ id: skill.id, details: changed }, { onSuccess: onSaved });
        })}
      >
        <FieldGroup>
          <DetailsFields describe="What the skill does and when to use it" required />
        </FieldGroup>
        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
