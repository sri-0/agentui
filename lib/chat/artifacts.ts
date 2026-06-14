import type { ChatDataParts, ChatMessage } from "./types";

export type ArtifactData = ChatDataParts["artifact"];

export type ArtifactSummary = {
  id: string;
  title: string;
  kind: ArtifactData["kind"];
};

/** The full artifact (latest content) by id, or undefined. */
export function findArtifact(
  messages: ChatMessage[],
  id: string,
): ArtifactData | undefined {
  let found: ArtifactData | undefined;
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "data-artifact" && p.data.id === id) found = p.data;
    }
  }
  return found;
}

const EXT: Record<string, string> = {
  csv: "csv",
  json: "json",
  html: "html",
  markdown: "md",
};
const MIME: Record<string, string> = {
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
};

/** Download the artifact as a file (csv → .csv opens in Excel, etc.). */
export function downloadArtifact(a: ArtifactData) {
  const ext = a.kind === "code" ? (a.language ?? "txt") : (EXT[a.kind] ?? "txt");
  const blob = new Blob([a.content], { type: MIME[a.kind] ?? "text/plain" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `${a.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "artifact"}.${ext}`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  URL.revokeObjectURL(url);
}

/**
 * All artifacts in the conversation, deduped by id (re-emitting the same id
 * updates it), in first-seen order. Used by the artifacts dropdown + top-bar
 * count.
 */
export function collectArtifacts(messages: ChatMessage[]): ArtifactSummary[] {
  const map = new Map<string, ArtifactSummary>();
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "data-artifact") {
        map.set(p.data.id, {
          id: p.data.id,
          title: p.data.title,
          kind: p.data.kind,
        });
      }
    }
  }
  return [...map.values()];
}
