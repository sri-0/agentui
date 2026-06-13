import type { UIMessage } from "ai";

/**
 * Per-message metadata carried alongside the parts.
 */
export type ChatMetadata = {
  threadId?: string;
  /** model id selected for this message */
  model?: string;
  /** agent id, if this message was produced by an agent */
  agentId?: string;
  /** wall-clock time the response took to stream, in ms */
  durationMs?: number;
  createdAt?: number;
};

/**
 * Custom data parts emitted by the proxy transformer (see lib/chat/pump-backend-sse.ts).
 * Each key becomes a `data-<key>` part type on the wire and in `message.parts`.
 *
 * Native parts (`text`, `reasoning`, `tool-*`) are NOT listed here — they use the
 * AI SDK's built-in part types so the AI Elements components work out of the box.
 */
export type ChatDataParts = {
  /** sub-agent lifecycle (started/done) for the multi-agent cards */
  "agent-step": { agent: string; step: number; status: "started" | "done" };
  /**
   * Sub-agent streamed text as an INCREMENTAL delta (one token chunk). Each is a
   * distinct part (unique id) so the wire stays O(n) — the client concatenates
   * a given agent's deltas to reconstruct its full output.
   */
  "agent-delta": { agent: string; step: number; delta: string };
  /** transient status line ("Analyzing…") — not persisted */
  "agent-progress": { phase: string; message: string; agent?: string };
  /** human-in-the-loop tool confirmation */
  "tool-interrupt": {
    toolCallId: string;
    toolName: string;
    prompt: string;
    details?: unknown;
    threadId?: string;
  };
  /** todo/task list snapshot — rendered above the composer (keyed, replaces prior) */
  "task-list": {
    tasks: { id: string; title: string; status: "pending" | "in_progress" | "completed" }[];
  };
  /** artifact pushed to the right sidepanel (keyed by id, re-emit to update) */
  artifact: {
    id: string;
    title: string;
    kind: "markdown" | "code" | "html" | "json";
    content: string;
    language?: string;
  };
  /** usage + context-window metering for the context circle / usage panel */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    contextUsed: number;
    contextWindow: number;
    breakdown?: { label: string; tokens: number }[];
  };
};

export type ChatMessage = UIMessage<ChatMetadata, ChatDataParts>;

/** Extra fields the client sends in the proxy request body alongside `messages`. */
export type ChatRequestBody = {
  agentId?: string;
  model?: string;
  threadId?: string;
  useRag?: boolean;
  temporary?: boolean;
  reasoningEffort?: "off" | "low" | "medium" | "high";
};
