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
 * Custom data parts emitted by the Go backend's AI SDK v6 stream.
 * Each key becomes a `data-<key>` part type on the wire and in `message.parts`.
 *
 * Native parts (`text`, `reasoning`, `tool-*`) are NOT listed here — they use the
 * AI SDK's built-in part types so the AI Elements components work out of the box.
 */
export type ChatDataParts = {
  /** sub-agent lifecycle (started/done) for the multi-agent cards.
   *  durationMs is set on the `done` step (how long the sub-agent ran). */
  "agent-step": {
    agent: string;
    step: number;
    status: "started" | "done";
    durationMs?: number;
  };
  /**
   * Sub-agent streamed output as an INCREMENTAL delta (one token chunk), split by
   * kind so the side panel can render reasoning separately from the answer. Each
   * is a distinct part (unique id) so the wire stays O(n) — the client
   * concatenates a given agent's deltas (per kind) to reconstruct its output.
   */
  "agent-delta": {
    agent: string;
    step: number;
    kind: "reasoning" | "text";
    delta: string;
  };
  /** transient status line ("Analyzing…") — not persisted */
  "agent-progress": { phase: string; message: string; agent?: string };
  /** human-in-the-loop tool confirmation. The tool part itself enters the
   *  native `approval-requested` state; this side-channel carries the backend
   *  threadId (no native slot) and records the user's decision for the badge. */
  "tool-interrupt": {
    toolCallId: string;
    toolName: string;
    prompt: string;
    details?: unknown;
    threadId?: string;
    resolved?: "approved" | "denied";
  };
  /** todo/task list snapshot from the `todowrite` tool (keyed, replaces prior) */
  "task-list": {
    tasks: {
      id: string;
      title: string;
      status: "pending" | "in_progress" | "completed" | "cancelled";
      priority?: "high" | "medium" | "low";
      /** owning sub-agent (worker) for swarm/coordinator boards */
      agent?: string;
    }[];
  };
  /** artifact pushed to the right sidepanel (keyed by id, re-emit to update) */
  artifact: {
    id: string;
    title: string;
    kind: "markdown" | "code" | "html" | "json" | "csv";
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

/**
 * Extra fields the client sends alongside `messages`. Held in camelCase here and
 * at the call sites; mapped to the Go backend's snake_case keys in the transport's
 * prepareSendMessagesRequest (see components/chat/use-agent-chat.ts).
 */
export type ChatRequestBody = {
  agentId?: string;
  model?: string;
  threadId?: string;
  useRag?: boolean;
  temporary?: boolean;
  reasoningEffort?: "off" | "low" | "medium" | "high";
};
