"use client";

import { Button } from "@/components/ui/button";
import { artifactUrl } from "@/lib/api/artifacts";
import { downloadArtifact } from "@/lib/chat/artifacts";
import { useThreadId } from "@/lib/chat/thread-context";
import type { Artifact, ToolPart } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import { DownloadIcon, LoaderIcon } from "lucide-react";
import { memo } from "react";

/**
 * A generate_image call: a placeholder while the image is made, then the
 * image (its artifact), which opens in the artifact panel, with a download
 * button on hover. Memoized on the part, like every part renderer.
 */
export const ImageCall = memo(function ImageCall({ part }: { part: ToolPart }) {
  const threadId = useThreadId();
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const image = part.state === "done" ? (part.output as Artifact | undefined) : undefined;

  if (!image?.id) {
    return (
      <div
        role="status"
        className="my-2 flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-sm text-muted-foreground"
      >
        <LoaderIcon className="size-4 animate-spin" />
        Generating image…
      </div>
    );
  }
  // The API is another origin, where <a download> only opens the image: save its bytes.
  const download = async () => {
    const res = await fetch(artifactUrl(threadId, image)).catch(() => undefined);
    if (res?.ok) downloadArtifact(image, await res.blob());
  };
  return (
    <div className="group/image relative my-2 w-full max-w-sm">
      <button
        type="button"
        title={image.title}
        onClick={() => openSidepanel({ kind: "artifact", artifactId: image.id })}
        className="block w-full overflow-hidden rounded-xl border transition-opacity group-hover/image:opacity-90"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, any size */}
        <img src={artifactUrl(threadId, image)} alt={image.title} className="w-full" />
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Download"
        aria-label="Download"
        onClick={download}
        // A halo in the page's colour keeps the bare icon clear on any image.
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/image:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 [&_svg]:drop-shadow-[0_0_2px_var(--background)]"
      >
        <DownloadIcon />
      </Button>
    </div>
  );
});
