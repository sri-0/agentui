import type { UIMessageStreamWriter } from "ai";

import type { ChatMessage } from "./types";

type Writer = UIMessageStreamWriter<ChatMessage>;

/**
 * Reads the backend's hybrid OpenAI/AG-UI SSE stream and drives the AI SDK
 * UI-message writer. See plans/01-streaming-architecture.md §3 for the full
 * branch table. Every `data:` line is either a real OpenAI chat.completion.chunk
 * or a custom wrapper (agent_event / agent_progress / tool_result /
 * tool_interrupt), each possibly carrying an embedded `ag_ui` object.
 */
export async function pumpBackendSse(
  body: ReadableStream<Uint8Array>,
  writer: Writer,
  meta?: { model?: string; agentId?: string },
): Promise<void> {
  const startedAt = Date.now();

  // Stamp the assistant message with the model/agent that produced it.
  if (meta && (meta.model || meta.agentId)) {
    writer.write({
      type: "message-metadata",
      messageMetadata: { model: meta.model, agentId: meta.agentId },
    });
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // --- per-turn state -------------------------------------------------------
  let textId: string | null = null;
  let reasoningId: string | null = null;
  let idSeq = 0;
  const nextId = (p: string) => `${p}-${idSeq++}`;

  // openai tool_calls accumulate by index → {id, name, argsBuffer}
  const toolCalls = new Map<
    number,
    { id: string; name: string; args: string; started: boolean }
  >();

  const ensureText = () => {
    if (textId === null) {
      textId = nextId("txt");
      writer.write({ type: "text-start", id: textId });
    }
  };
  const closeText = () => {
    if (textId !== null) {
      writer.write({ type: "text-end", id: textId });
      textId = null;
    }
  };
  const ensureReasoning = () => {
    if (reasoningId === null) {
      reasoningId = nextId("rsn");
      writer.write({ type: "reasoning-start", id: reasoningId });
    }
  };
  const closeReasoning = () => {
    if (reasoningId !== null) {
      writer.write({ type: "reasoning-end", id: reasoningId });
      reasoningId = null;
    }
  };
  const flushToolInputs = () => {
    for (const tc of toolCalls.values()) {
      if (!tc.started) continue;
      let input: unknown = tc.args;
      try {
        input = tc.args ? JSON.parse(tc.args) : {};
      } catch {
        /* keep raw string */
      }
      writer.write({
        type: "tool-input-available",
        toolCallId: tc.id,
        toolName: tc.name,
        input,
        dynamic: true,
      });
      tc.started = false; // mark flushed
    }
  };

  const handle = (json: Record<string, unknown>) => {
    // 1. Real OpenAI chunk -------------------------------------------------
    if (Array.isArray(json.choices)) {
      const choice = (json.choices as Record<string, unknown>[])[0] ?? {};
      const delta = (choice.delta ?? {}) as Record<string, unknown>;

      // Reasoning may arrive as `reasoning` or `reasoning_content`; accept either.
      const reasoningDelta =
        (typeof delta.reasoning === "string" && delta.reasoning) ||
        (typeof delta.reasoning_content === "string" && delta.reasoning_content);
      if (reasoningDelta) {
        closeText();
        ensureReasoning();
        writer.write({
          type: "reasoning-delta",
          id: reasoningId as string,
          delta: reasoningDelta,
        });
      }

      if (typeof delta.content === "string" && delta.content) {
        closeReasoning();
        ensureText();
        writer.write({
          type: "text-delta",
          id: textId as string,
          delta: delta.content,
        });
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const raw of delta.tool_calls as Record<string, unknown>[]) {
          const index = typeof raw.index === "number" ? raw.index : 0;
          const fn = (raw.function ?? {}) as Record<string, unknown>;
          let tc = toolCalls.get(index);
          if (!tc) {
            tc = {
              id: (raw.id as string) || nextId("tool"),
              name: (fn.name as string) || "tool",
              args: "",
              started: false,
            };
            toolCalls.set(index, tc);
          }
          if (raw.id) tc.id = raw.id as string;
          if (fn.name) tc.name = fn.name as string;
          if (!tc.started) {
            closeText();
            writer.write({
              type: "tool-input-start",
              toolCallId: tc.id,
              toolName: tc.name,
              dynamic: true,
            });
            tc.started = true;
          }
          if (typeof fn.arguments === "string" && fn.arguments) {
            tc.args += fn.arguments;
            writer.write({
              type: "tool-input-delta",
              toolCallId: tc.id,
              inputTextDelta: fn.arguments,
            });
          }
        }
      }

      const finish = choice.finish_reason;
      if (finish === "tool_calls") flushToolInputs();

      // usage on the terminal chunk (after backend change)
      const usage = json.usage as Record<string, number> | undefined;
      if (usage && typeof usage.total_tokens === "number") {
        writeUsage(writer, usage, json);
      }
      return;
    }

    // 2. Sub-agent streamed output (incremental delta, O(n) wire) ---------
    // Symmetric delta shape: `text_delta` carries `content`, `reasoning_delta`
    // carries `reasoning_content`. Both map to one data part via `kind`.
    if (json.agent_event && typeof json.agent_event === "object") {
      const ev = json.agent_event as Record<string, unknown>;
      const agent = (ev.agent as string) || "agent";
      const step = (ev.step as number) ?? 0;

      if (ev.type === "text_delta" && ev.content) {
        writer.write({
          type: "data-agent-delta",
          id: nextId("adelta"),
          data: { agent, step, kind: "text", delta: ev.content as string },
        });
      } else if (ev.type === "reasoning_delta" && ev.reasoning_content) {
        writer.write({
          type: "data-agent-delta",
          id: nextId("adelta"),
          data: {
            agent,
            step,
            kind: "reasoning",
            delta: ev.reasoning_content as string,
          },
        });
      }
      // tool_call / tool_result / text_done are surfaced as per-agent steps via
      // the attributed `agent_progress` (executing) events — see branch 3.
      return;
    }

    // 3. Agent progress / step lifecycle ----------------------------------
    if (json.agent_progress && typeof json.agent_progress === "object") {
      const p = json.agent_progress as Record<string, unknown>;
      const phase = (p.phase as string) ?? "";
      if (phase === "agent_start" || phase === "agent_done") {
        const done = phase === "agent_done";
        const durationMs = p.duration_ms;
        writer.write({
          type: "data-agent-step",
          id: `${(p.agent as string) ?? "agent"}-${(p.step as number) ?? 0}`,
          data: {
            agent: (p.agent as string) ?? "agent",
            step: (p.step as number) ?? 0,
            status: done ? "done" : "started",
            ...(done && typeof durationMs === "number" ? { durationMs } : {}),
          },
        });
      } else {
        // Persist progress phases (planning / executing / …) as discrete steps
        // so the top-level agent's progress can be rendered as a step log.
        writer.write({
          type: "data-agent-progress",
          id: nextId("prog"),
          data: {
            phase,
            message: (p.message as string) ?? "",
            agent: p.agent as string | undefined,
          },
        });
      }
      return;
    }

    // 4. Tool result ------------------------------------------------------
    if (json.tool_result && typeof json.tool_result === "object") {
      const tr = json.tool_result as Record<string, unknown>;
      writer.write({
        type: "tool-output-available",
        toolCallId: (tr.toolCallId as string) ?? "",
        output: tr.result,
        dynamic: true,
      });
      return;
    }

    // 5. HITL tool interrupt ----------------------------------------------
    if (json.tool_interrupt && typeof json.tool_interrupt === "object") {
      const ti = json.tool_interrupt as Record<string, unknown>;
      writer.write({
        type: "data-tool-interrupt",
        id: (ti.toolCallId as string) ?? nextId("int"),
        data: {
          toolCallId: (ti.toolCallId as string) ?? "",
          toolName: (ti.toolName as string) ?? "tool",
          prompt: (ti.prompt as string) ?? "",
          details: ti.details,
          threadId: ti.thread_id as string | undefined,
        },
      });
      return;
    }

    // 6. Bare ag_ui CUSTOM events (task_list / artifact / context_usage) ---
    if (json.ag_ui && typeof json.ag_ui === "object") {
      handleAgUi(json.ag_ui as Record<string, unknown>, writer);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      // SSE events are separated by a blank line
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of rawEvent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            handle(JSON.parse(payload) as Record<string, unknown>);
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    }
  } finally {
    flushToolInputs();
    closeReasoning();
    closeText();
    // Final metadata carries everything (merge-safe) incl. the elapsed time.
    writer.write({
      type: "message-metadata",
      messageMetadata: {
        model: meta?.model,
        agentId: meta?.agentId,
        durationMs: Date.now() - startedAt,
      },
    });
    reader.releaseLock();
  }
}

function handleAgUi(ev: Record<string, unknown>, writer: Writer) {
  const type = ev.type as string;
  const name = ev.name as string | undefined;
  const value = (ev.value ?? {}) as Record<string, unknown>;

  if (type === "CUSTOM" && name === "task_list") {
    writer.write({
      type: "data-task-list",
      id: "tasks",
      data: { tasks: (value.tasks as never) ?? [] },
    });
    return;
  }
  if (type === "CUSTOM" && name === "artifact") {
    writer.write({
      type: "data-artifact",
      id: (value.id as string) ?? "artifact",
      data: {
        id: (value.id as string) ?? "artifact",
        title: (value.title as string) ?? "Artifact",
        kind: ((value.kind as string) ?? "markdown") as never,
        content: (value.content as string) ?? "",
        language: value.language as string | undefined,
      },
    });
    return;
  }
  if (type === "CUSTOM" && name === "context_usage") {
    writer.write({
      type: "data-usage",
      id: "usage",
      data: {
        promptTokens: (value.prompt_tokens as number) ?? 0,
        completionTokens: (value.completion_tokens as number) ?? 0,
        totalTokens: (value.total_tokens as number) ?? 0,
        contextUsed: (value.context_used as number) ?? 0,
        contextWindow: (value.context_window as number) ?? 0,
        breakdown: value.breakdown as never,
      },
    });
  }
}

function writeUsage(
  writer: Writer,
  usage: Record<string, number>,
  chunk: Record<string, unknown>,
) {
  writer.write({
    type: "data-usage",
    id: "usage",
    data: {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
      contextUsed: usage.prompt_tokens ?? 0,
      contextWindow:
        (chunk.context_window as number) ?? usage.context_window ?? 0,
    },
  });
}
