import type { Event as AgUiEvent, Interrupt } from "@ag-ui/core";

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
  status: "running" | "waiting" | "done" | "error";
  startedAt: number;
  durationMs?: number;
  error?: string;
  progress?: string;
  log?: { at: number; message: string }[];
  text?: string;
  /** The requests a paused sub-agent waits on (status "waiting"); answered on its thread. */
  interrupts?: Interrupt[];
};

export type Task = { id: string; title: string; status: string };

/** A published artifact: a document with a body (fetched from the API),
 *  kind "url", a page to embed, or kind "image", an image (made by
 *  generate_image or the Images page). */
export type Artifact = {
  id: string;
  title: string;
  kind: "markdown" | "code" | "json" | "csv" | "url" | "image";
  language?: string;
  /** kind url: the page to embed */
  url?: string;
  /** bumped each time the artifact is published again under its id */
  version?: number;
  /** the body, only in threads from before artifacts were stored */
  content?: string;
  /** set on artifacts listed by the API */
  updated_at?: string;
};

/** A context compaction (the `compaction` activity): the backend summarised the
 *  earlier conversation, which the model now sees as `summary`. "declined"
 *  means the summary was discarded and nothing changed. */
export type Compaction = {
  status: "running" | "completed" | "failed" | "declined";
  summary?: string;
  /** what the summarizer read and wrote */
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  error?: string;
};

/** The turn ran on another model than the thread's previous turn (the
 *  `model` activity): ids of the form <provider>/<model>. */
export type ModelChange = { from: string; to: string };

/** A skill a /name loaded into its turn (the `skill` activity); turns stored
 *  before skills had ids have none. */
export type SkillUse = { id?: string; name: string; title?: string; description: string };

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
  /** What a paused call asks: for the `question` tool, its questions. */
  request?: { toolName: string; args: unknown };
  /** The UI renderer the tool asks for (see components/chat/messages/tools). */
  ui?: string;
  /** Event timestamps: when the call was announced and how long until its result. */
  startedAt?: number;
  durationMs?: number;
};

/** A model call by the named agent; a pipeline has one per stage. */
export type StepPart = { type: "step-start"; agent: string; done: boolean };

export type DataPart =
  | { type: "data-agent"; id: string; data: AgentCard }
  | { type: "data-task-list"; id: string; data: { tasks: Task[] } }
  | { type: "data-artifact"; id: string; data: Artifact }
  | { type: "data-compaction"; id: string; data: Compaction }
  | { type: "data-model"; id: string; data: ModelChange }
  | { type: "data-skill"; id: string; data: SkillUse };

export type ChatPart = TextPart | ReasoningPart | ToolPart | StepPart | DataPart;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  metadata?: ChatMetadata;
};

export type { AgUiEvent };
