import { EventType, type Event as AgUiEvent, type RunFinishedEvent } from "@ag-ui/core";

import type {
  ChatMessage,
  ChatMetadata,
  ChatPart,
  DataPart,
  ReasoningPart,
  StepPart,
  TextPart,
  ToolPart,
} from "./types";

export type ThreadStatus = "idle" | "streaming" | "awaiting_input" | "error";

export type ThreadState = {
  messages: ChatMessage[];
  status: ThreadStatus;
  /** A failure to start, resume or reach a run (REST); run errors sit on their message. */
  error?: string;
  /** History has been fetched and folded. */
  loaded: boolean;
};

export const emptyThread: ThreadState = { messages: [], status: "idle", loaded: false };

/** Activity types the backend emits, mapped to their part types. */
const ACTIVITY_PARTS: Record<string, DataPart["type"]> = {
  agent: "data-agent",
  task_list: "data-task-list",
  artifact: "data-artifact",
};

/**
 * Fold one AG-UI event into the thread. Pure: returns a new state that shares
 * every message and part it did not touch. The same function folds stored
 * history and the live stream.
 */
export function reduce(state: ThreadState, event: AgUiEvent): ThreadState {
  switch (event.type) {
    case EventType.RUN_STARTED: {
      const meta = (event.metadata ?? {}) as Record<string, unknown>;
      const turnId = str(meta.turnId) ?? event.runId;
      const metadata: ChatMetadata = {
        agentId: str(meta.agentId),
        model: str(meta.model),
        createdAt: num(meta.createdAt),
      };
      const last = state.messages.at(-1);
      // A resumed segment continues the turn it belongs to.
      const messages =
        last?.id === turnId
          ? replaceLast(state.messages, { ...last, metadata: { ...last.metadata, ...metadata } })
          : [...state.messages, { id: turnId, role: "assistant" as const, parts: [], metadata }];
      return { ...state, messages, status: "streaming", error: undefined };
    }

    case EventType.STEP_STARTED:
      return withLast(state, (m) =>
        push(m, { type: "step-start", agent: event.stepName, done: false }),
      );
    case EventType.STEP_FINISHED:
      return updatePart(state, isOpenStep, (p) => ({ ...p, done: true }));

    case EventType.TEXT_MESSAGE_START: {
      const part: TextPart = { type: "text", id: event.messageId, text: "", done: false };
      if (event.role === "user") return upsertUser(state, event.messageId, part);
      return withLast(state, (m) => push(m, part));
    }
    case EventType.TEXT_MESSAGE_CONTENT:
      return updatePart(state, isText(event.messageId), (p) => ({ ...p, text: p.text + event.delta }));
    case EventType.TEXT_MESSAGE_END:
      return updatePart(state, isText(event.messageId), (p) => ({ ...p, done: true }));

    case EventType.REASONING_MESSAGE_START:
      return withLast(state, (m) =>
        push(m, {
          type: "reasoning",
          id: event.messageId,
          text: "",
          done: false,
          startedAt: event.timestamp,
        }),
      );
    case EventType.REASONING_MESSAGE_CONTENT:
      return updatePart(state, isReasoning(event.messageId), (p) => ({ ...p, text: p.text + event.delta }));
    case EventType.REASONING_MESSAGE_END:
      return updatePart(state, isReasoning(event.messageId), (p) => ({ ...p, done: true }));
    case EventType.REASONING_END:
      return updatePart(state, isReasoning(event.messageId), (p) => ({
        ...p,
        durationMs:
          p.startedAt != null && event.timestamp != null
            ? Math.max(0, event.timestamp - p.startedAt)
            : undefined,
      }));

    case EventType.TOOL_CALL_START:
      return withLast(state, (m) =>
        push(m, {
          type: "tool",
          toolCallId: event.toolCallId,
          toolName: event.toolCallName,
          state: "running",
          argsText: "",
          startedAt: event.timestamp,
        }),
      );
    case EventType.TOOL_CALL_ARGS:
      return updatePart(state, isTool(event.toolCallId), (p) => ({
        ...p,
        argsText: (p.argsText ?? "") + event.delta,
      }));
    case EventType.TOOL_CALL_END:
      return updatePart(state, isTool(event.toolCallId), (p) => ({
        ...p,
        input: parseJSON(p.argsText ?? "") ?? {},
        argsText: undefined,
      }));
    case EventType.TOOL_CALL_RESULT: {
      const raw = typeof event.content === "string" ? event.content : JSON.stringify(event.content);
      const output = parseJSON(raw) ?? raw;
      const error = errorText(output);
      return updatePart(state, isTool(event.toolCallId), (p) =>
        p.state === "denied"
          ? p
          : {
              ...p,
              durationMs:
                p.startedAt != null && event.timestamp != null
                  ? Math.max(0, event.timestamp - p.startedAt)
                  : undefined,
              ...(error != null ? { state: "error", errorText: error } : { state: "done", output }),
            },
      );
    }

    case EventType.ACTIVITY_SNAPSHOT: {
      const type = ACTIVITY_PARTS[event.activityType];
      if (!type) return state;
      const part = { type, id: event.messageId, data: event.content } as DataPart;
      return withLast(state, (m) => {
        const i = m.parts.findIndex((p) => p.type === type && p.id === event.messageId);
        return i === -1 ? push(m, part) : { ...m, parts: m.parts.with(i, part) };
      });
    }
    case EventType.SUBAGENT_FINISHED:
      return updatePart(state, isAgent(event.subagentRunId), (p) => ({
        ...p,
        data: { ...p.data, status: "done" },
      }));
    case EventType.SUBAGENT_ERROR:
      return updatePart(state, isAgent(event.subagentRunId), (p) => ({
        ...p,
        data: { ...p.data, status: "error", error: event.message },
      }));

    case EventType.CUSTOM: {
      if (event.name !== "approval") return state;
      const v = event.value as { toolCallId: string; approved: boolean; justification?: string };
      return updatePart(state, isTool(v.toolCallId), (p) => ({
        ...p,
        state: v.approved ? "running" : "denied",
        approval: { id: p.approval?.id ?? "", approved: v.approved, reason: v.justification },
      }));
    }

    case EventType.RUN_FINISHED:
      return finish(state, event);

    case EventType.RUN_ERROR:
      return {
        ...withLast(state, (m) => ({ ...m, metadata: { ...m.metadata, error: event.message } })),
        status: "error",
      };

    default:
      return state;
  }
}

function finish(state: ThreadState, event: RunFinishedEvent): ThreadState {
  const usage = (event.usage ?? []).reduce<ChatMetadata["usage"] & object>(
    (acc, u) => ({
      inputTokens: acc.inputTokens + (u.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (u.outputTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
  const outcome = event.outcome?.type ?? "success";
  const interrupts = event.outcome?.type === "interrupt" ? event.outcome.interrupts : [];
  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  let next = withLast(state, (m) => ({
    ...m,
    metadata: {
      ...m.metadata,
      usage,
      durationMs: num(meta.durationMs),
      cancelled: outcome === "cancelled" || undefined,
    },
  }));
  // Every interrupt names the tool call it holds (an approval or a question);
  // a run that ends without pausing leaves no call waiting.
  for (const i of interrupts) {
    if (i.toolCallId) {
      next = updatePart(next, isTool(i.toolCallId), (p) => ({ ...p, state: "approval", approval: { id: i.id }, prompt: i.message }));
    }
  }
  if (outcome !== "interrupt") {
    next = withLast(next, (m) =>
      m.parts.some((p) => p.type === "tool" && p.state === "approval")
        ? { ...m, parts: m.parts.map((p) => (p.type === "tool" && p.state === "approval" ? { ...p, state: "denied" } : p)) }
        : m,
    );
  }
  return { ...next, status: outcome === "interrupt" ? "awaiting_input" : "idle" };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Apply `fn` to the assistant turn in progress (the last message). */
function withLast(state: ThreadState, fn: (m: ChatMessage) => ChatMessage): ThreadState {
  const last = state.messages.at(-1);
  if (!last || last.role !== "assistant") return state;
  return { ...state, messages: replaceLast(state.messages, fn(last)) };
}

/** Replace the newest part matching `is` with `fn(part)`; unchanged if none. */
function updatePart<P extends ChatPart>(
  state: ThreadState,
  is: (p: ChatPart) => p is P,
  fn: (p: P) => ChatPart,
): ThreadState {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    const j = m.parts.findLastIndex(is);
    if (j === -1) continue;
    const next = fn(m.parts[j] as P);
    if (next === m.parts[j]) return state;
    return { ...state, messages: state.messages.with(i, { ...m, parts: m.parts.with(j, next) }) };
  }
  return state;
}

/** The user turn: replaces the optimistic copy the composer appended, if any. */
function upsertUser(state: ThreadState, id: string, part: TextPart): ThreadState {
  const i = state.messages.findIndex((m) => m.id === id);
  const message: ChatMessage = { id, role: "user", parts: [part] };
  return {
    ...state,
    messages: i === -1 ? [...state.messages, message] : state.messages.with(i, message),
  };
}

function replaceLast(messages: ChatMessage[], m: ChatMessage): ChatMessage[] {
  return messages.with(messages.length - 1, m);
}

function push(m: ChatMessage, part: ChatPart): ChatMessage {
  return { ...m, parts: [...m.parts, part] };
}

const isOpenStep = (p: ChatPart): p is StepPart => p.type === "step-start" && !p.done;
const isText = (id: string) => (p: ChatPart): p is TextPart => p.type === "text" && p.id === id;
const isReasoning = (id: string) => (p: ChatPart): p is ReasoningPart =>
  p.type === "reasoning" && p.id === id;
const isTool = (id: string) => (p: ChatPart): p is ToolPart => p.type === "tool" && p.toolCallId === id;
const isAgent = (runId: string | undefined) => (p: ChatPart): p is Extract<DataPart, { type: "data-agent" }> =>
  p.type === "data-agent" && p.data.subagentRunId === runId;

function parseJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** A tool result shaped `{error: "..."}` is a failure. */
function errorText(output: unknown): string | undefined {
  if (output && typeof output === "object" && "error" in output) {
    const e = (output as { error: unknown }).error;
    if (typeof e === "string" && Object.keys(output).length === 1) return e;
  }
  return undefined;
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);
