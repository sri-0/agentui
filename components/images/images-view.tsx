"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { artifactUrl, useThreadArtifacts } from "@/lib/api/artifacts";
import { useMakeImage } from "@/lib/api/images";
import { useImageModels } from "@/lib/api/models";
import type { Artifact } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { LoaderIcon, PencilIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The default model's value in the select: the server picks it (models.yaml). */
const DEFAULT_MODEL = "default";

/**
 * The Images page: a prompt and an image model in, an image out, kept as an
 * artifact of the page's conversation (the first image starts one). Each
 * image can be edited: the next prompt then changes it, as its next version.
 */
export function ImagesView({ threadId }: { threadId?: string }) {
  const router = useRouter();
  const { data: artifacts = [] } = useThreadArtifacts(threadId ?? "");
  const images = artifacts.filter((a) => a.kind === "image").reverse(); // oldest first, like a chat
  const make = useMakeImage();
  const [editing, setEditing] = useState<Artifact>();
  const model = useImageModel();

  // Returning the promise keeps the prompt in the box when it fails.
  const submit = async ({ text }: PromptInputMessage) => {
    const prompt = text.trim();
    if (!prompt || make.isPending) return;
    const made = await make.mutateAsync({ prompt, model: model ?? undefined, threadId, edit: editing?.id });
    setEditing(undefined);
    // To the new conversation, unless the user has gone elsewhere meanwhile.
    if (!threadId && window.location.pathname === "/images") router.replace(`/images/${made.threadId}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger className="text-muted-foreground" />
        <h1 className="text-sm font-medium">Images</h1>
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-4 py-6">
          {!threadId && !make.isPending && (
            <div className="mt-24 text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Describe an image</h2>
              <p className="mt-3 text-[15px] text-muted-foreground">
                Pick an image model; every image is kept with your artifacts.
              </p>
            </div>
          )}
          {images.map((image) => (
            <ImageEntry
              key={image.id}
              threadId={threadId!}
              image={image}
              editing={editing?.id === image.id}
              onEdit={() => setEditing(image)}
            />
          ))}
          {make.isPending && (
            <figure className="flex flex-col gap-2">
              <figcaption className="text-sm text-muted-foreground">{make.variables?.prompt}</figcaption>
              <div
                role="status"
                className="flex aspect-square w-full max-w-md items-center justify-center gap-2 rounded-xl border bg-muted/40 text-sm text-muted-foreground"
              >
                <LoaderIcon className="size-4 animate-spin" />
                Generating image…
              </div>
            </figure>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-5">
        {make.error && (
          <p role="alert" className="mb-2 text-center text-xs text-destructive">
            {make.error.message}
          </p>
        )}
        <PromptInputProvider>
          <PromptInput onSubmit={submit}>
            {editing && (
              <div className="flex items-center gap-2 px-3 pt-3 text-xs text-muted-foreground">
                <PencilIcon className="size-3" />
                <span className="min-w-0 truncate">Editing “{editing.title}”</span>
                <Button variant="ghost" size="icon-xs" aria-label="Stop editing" onClick={() => setEditing(undefined)}>
                  <XIcon />
                </Button>
              </div>
            )}
            <PromptInputBody>
              <PromptInputTextarea placeholder={editing ? "What should change?" : "A lighthouse at dusk, in watercolour…"} />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <ImageModelSelect value={model} />
              </PromptInputTools>
              <PromptInputSubmit status={make.isPending ? "submitted" : "ready"} disabled={make.isPending} />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  );
}

/** One image of the conversation, under its prompt, with its edit button. */
function ImageEntry({
  threadId,
  image,
  editing,
  onEdit,
}: {
  threadId: string;
  image: Artifact;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">{image.title}</span>
        {(image.version ?? 1) > 1 && <span className="shrink-0 text-xs">version {image.version}</span>}
        <Button variant={editing ? "secondary" : "ghost"} size="xs" className="ml-auto" aria-pressed={editing} onClick={onEdit}>
          <PencilIcon /> Edit
        </Button>
      </figcaption>
      <a href={artifactUrl(threadId, image)} target="_blank" rel="noopener noreferrer" className="w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, any size */}
        <img src={artifactUrl(threadId, image)} alt={image.title} className="w-full rounded-xl border" />
      </a>
    </figure>
  );
}

/** The image model chosen, or null for the server's default (also when the
 *  stored choice is no longer served). */
function useImageModel() {
  const { data: models = [] } = useImageModels();
  const stored = useUiStore((s) => s.selectedImageModel);
  return models.some((m) => m.id === stored) ? stored : null;
}

/** The image models; "Default" leaves the choice to the server. */
function ImageModelSelect({ value }: { value: string | null }) {
  const { data: models = [] } = useImageModels();
  const setImageModel = useUiStore((s) => s.setImageModel);
  return (
    <PromptInputSelect
      value={value ?? DEFAULT_MODEL}
      onValueChange={(v) => setImageModel(v === DEFAULT_MODEL ? null : v)}
    >
      <PromptInputSelectTrigger aria-label="Image model">
        <PromptInputSelectValue />
      </PromptInputSelectTrigger>
      <PromptInputSelectContent>
        <PromptInputSelectItem value={DEFAULT_MODEL}>Default model</PromptInputSelectItem>
        {models.map((m) => (
          <PromptInputSelectItem key={m.id} value={m.id}>
            {m.name ?? m.id}
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  );
}
