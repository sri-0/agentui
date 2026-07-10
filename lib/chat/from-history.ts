import type { ThreadMessage } from "@/lib/api/types";

import type { ChatMessage } from "./types";

// TODO(W4): full-parts rehydration. Reconstruct full AI-SDK `parts`
// (reasoning/tools/artifacts/sub-agent cards/task list) from
// `GET /v1/threads/{id}/messages` so a reload renders identically to live.
// Deferred: depends on the backend W4 projector (`ProjectMessages`) which isn't
// merged yet — the endpoint still returns text-only. Keep this text-only until
// the backend emits `parts`.
/** Convert backend thread history into AI SDK UI messages (text parts only). */
export function fromHistory(messages: ThreadMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => ({
      id: (m.id as string) ?? `history-${i}`,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content ?? "" }],
    }));
}
