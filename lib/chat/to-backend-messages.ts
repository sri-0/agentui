import type { UIMessage } from "ai";

type BackendMessage = { role: string; content: string };

/**
 * The backend's ChatMessage is text-only ({role, content}). Flatten each UI
 * message's text parts into a single content string. File parts are dropped for
 * now (upload/RAG ingestion is deferred — see plans/02-backend-changes.md §E).
 */
export function toBackendMessages(messages: UIMessage[]): BackendMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("\n\n"),
  }));
}
