"use client";

import { artifactUrl } from "@/lib/api/artifacts";
import { useThreadId } from "@/lib/chat/thread-context";
import type { Artifact, ToolPart } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { LoaderIcon } from "lucide-react";
import { memo } from "react";

/**
 * A generate_image call: a placeholder while the image is made, then the
 * image (its artifact), which opens in the artifact panel. Memoized on the
 * part, like every part renderer.
 */
export const ImageCall = memo(function ImageCall({ part }: { part: ToolPart }) {
  const threadId = useThreadId();
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const image = part.state === "done" ? (part.output as Artifact | undefined) : undefined;

  if (!image?.id) {
    return (
      <div className="my-2 flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-sm text-muted-foreground">
        <LoaderIcon className="size-4 animate-spin" />
        Generating image…
      </div>
    );
  }
  return (
    <button
      type="button"
      title={image.title}
      onClick={() => openSidepanel({ kind: "artifact", artifactId: image.id })}
      className="my-2 block w-full max-w-sm overflow-hidden rounded-xl border transition-opacity hover:opacity-90"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, any size */}
      <img src={artifactUrl(threadId, image)} alt={image.title} className="w-full" />
    </button>
  );
});
