import type { ThreadMessage } from "@/lib/api/types";

import type { ChatMessage } from "./types";

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
