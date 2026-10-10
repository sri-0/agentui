import type { Event as AgUiEvent } from "@ag-ui/core";

/**
 * The view model the chat renders, built by `lib/chat/reduce.ts` from the AG-UI
 * events the backend streams and stores. These are our own shapes; nothing
 * here depends on the AI SDK.
 */

/** One question asked by the `question` tool (its call input). */
export type Question = {
  question: string;
  header: string;
  options: { label: string; description?: string }[];
  multiple?: boolean;
};

/** Per-turn metadata, from RUN_STARTED and RUN_FINISHED. */
export type ChatMetadata = {
  agentId?: string;
  model?: string;
  createdAt?: number;
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number };
  cancelled?: boolean;
  error?: string;
};

/** The parent's view of a sub-agent (the `agent` activity), keyed by run id. */
export type AgentCard = {
  subagentRunId: string;
  childThreadId: string;
  name: string;
  description?: string;
  parentToolCallId: string;
  status: "running" | "done" | "error";
  startedAt: number;
  durationMs?: number;
  error?: string;
  progress?: string;
  log?: { at: number; message: string }[];
  text?: string;
};

export type Task = { id: string; title: string; status: string };

export type Artifact = {
  id: string;
  title: string;
  kind: "markdown" | "code" | "html" | "json" | "csv" | "file";
  content: string;
  language?: string;
  url?: string;
  mime?: string;
  filename?: string;
  size?: number;
};

export type TextPart = { type: "text"; id: string; text: string; done: boolean };

export type ReasoningPart = {
  type: "reasoning";
  id: string;
  text: string;
  done: boolean;
  startedAt?: number;
  durationMs?: number;
};

/** Where a tool call is: running (args streaming or executing), finished, or
 *  held for the user's approval. */
export type ToolState = "running" | "done" | "error" | "approval" | "denied";

export type ToolPart = {
  type: "tool";
  toolCallId: string;
  toolName: string;
  state: ToolState;
  /** JSON of the arguments while they stream in. */
  argsText?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  /** The pending or decided confirmation. */
  approval?: { id: string; approved?: boolean; reason?: string };
  /** What the backend asks the user to confirm. */
  prompt?: string;
  /** Event timestamps: when the call was announced and how long until its result. */
  startedAt?: number;
  durationMs?: number;
};

/** A model call by the named agent; a pipeline has one per stage. */
export type StepPart = { type: "step-start"; agent: string; done: boolean };

export type DataPart =
  | { type: "data-agent"; id: string; data: AgentCard }
  | { type: "data-task-list"; id: string; data: { tasks: Task[] } }
  | { type: "data-artifact"; id: string; data: Artifact };

export type ChatPart = TextPart | ReasoningPart | ToolPart | StepPart | DataPart;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  metadata?: ChatMetadata;
};

export type { AgUiEvent };
