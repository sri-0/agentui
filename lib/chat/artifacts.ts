import { useMemo } from "react";

import { useThreadArtifacts } from "@/lib/api/artifacts";

import type { Artifact, ChatMessage } from "./types";

/** The artifacts announced in the loaded messages, latest version of each,
 *  in first-seen order. */
export function collectArtifacts(messages: ChatMessage[]): Artifact[] {
  const byId = new Map<string, Artifact>();
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "data-artifact") byId.set(p.data.id, p.data);
    }
  }
  return [...byId.values()];
}

/** Every artifact of the conversation, newest first: the stored list, with
 *  what the live stream announced (`collectArtifacts`) laid over it. */
export function useArtifacts(threadId: string, live: Artifact[]): Artifact[] {
  const { data: stored = [] } = useThreadArtifacts(threadId);
  return useMemo(() => {
    const latest = new Map(live.map((a) => [a.id, a]));
    const known = new Set(stored.map((a) => a.id));
    const announced = live.filter((a) => !known.has(a.id)).reverse();
    const updated = stored.map((a) => {
      const l = latest.get(a.id);
      return l && (l.version ?? 0) >= (a.version ?? 0) ? { ...a, ...l } : a;
    });
    return [...announced, ...updated];
  }, [stored, live]);
}

const EXT: Record<string, string> = { markdown: "md", json: "json", csv: "csv" };
const MIME: Record<string, string> = {
  markdown: "text/markdown",
  json: "application/json",
  csv: "text/csv",
};

/** Save an artifact's body as a file (csv opens in Excel, an image as its
 *  own type, and so on). */
export function downloadArtifact(a: Artifact, body: string | Blob) {
  const blob = typeof body === "string" ? new Blob([body], { type: MIME[a.kind] ?? "text/plain" }) : body;
  const ext = a.kind === "image" ? blob.type.split("/")[1] : a.kind === "code" ? (a.language ?? "txt") : (EXT[a.kind] ?? "txt");
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `${a.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "artifact"}.${ext}`;
  el.click();
  URL.revokeObjectURL(url);
}
