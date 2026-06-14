"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import type { ChatMessage } from "@/lib/chat/types";

export function ArtifactView({
  messages,
  artifactId,
}: {
  messages: ChatMessage[];
  artifactId: string;
}) {
  let artifact: ChatMessage["parts"][number] | undefined;
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "data-artifact" && p.data.id === artifactId) artifact = p;
    }
  }
  if (!artifact || artifact.type !== "data-artifact") {
    return <p className="text-sm text-muted-foreground">Artifact not found.</p>;
  }
  const { kind, content, language } = artifact.data;
  const md =
    kind === "code"
      ? `\`\`\`${language ?? ""}\n${content}\n\`\`\``
      : kind === "json"
        ? `\`\`\`json\n${content}\n\`\`\``
        : content;
  return <MessageResponse>{md}</MessageResponse>;
}
