# 01 — Streaming Architecture (the core)

How the backend's hybrid SSE becomes typed AI SDK v6 UI-message parts, and how each part renders. This is the most important document — get the transformer right and the rest is conventional React.

---

## 1. The typed message

Define one app-wide message type so `useChat` and every renderer are type-safe.

```ts
// lib/chat/types.ts
import type { UIMessage } from 'ai';

export type ChatMetadata = {
  threadId?: string;
  model?: string;        // model or agent id used
  createdAt?: number;
};

// Custom data parts. Keys here become part type `data-<key>` on the wire & in message.parts.
export type ChatDataParts = {
  'agent-step':     { agent: string; step: number; status: 'started' | 'done' };
  'agent-stream':   { agent: string; step: number; text: string };   // sub-agent streamed text (for sidepanel), keyed by agent
  'agent-progress': { phase: string; message: string; agent?: string }; // transient status line
  'tool-interrupt': { toolCallId: string; toolName: string; prompt: string; details?: unknown };
  'task-list':      { tasks: { id: string; title: string; status: 'pending' | 'in_progress' | 'completed' }[] };
  'artifact':       { id: string; title: string; kind: string; content: string; language?: string };
  'usage':          { promptTokens: number; completionTokens: number; totalTokens: number;
                      contextUsed: number; contextWindow: number;
                      breakdown?: { label: string; tokens: number }[] };
};

export type ChatMessage = UIMessage<ChatMetadata, ChatDataParts>;
```

Reasoning, text, and tool calls use **native** AI SDK parts (`text`, `reasoning`, dynamic `tool-*`), not custom data parts — so the AI Elements `Reasoning`, `Response`, and `Tool` components work out of the box.

---

## 2. The proxy route — `app/api/chat/route.ts`

Responsibilities:
1. Receive the `useChat` POST (`{ messages, ... }` in AI SDK UI format) plus any extra body fields we add (`agentId`, `model`, `threadId`, `useRag`, `temporary`).
2. Convert UI messages → the backend's minimal `{role, content}` shape (`convertToModelMessages` then flatten to text, since the backend `ChatMessage` is text-only).
3. `fetch` backend `POST /v1/chat/completions` with `stream:true`, **forwarding all inbound headers** (`req.headers`), minus hop-by-hop (`host`, `content-length`, `connection`).
4. Parse the backend SSE and drive a `UIMessageStreamWriter`.
5. Return `createUIMessageStreamResponse({ stream })` with `X-Accel-Buffering: no`.

```ts
// sketch — verify exact APIs against node_modules/ai/dist/index.d.ts
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages, agentId, model, threadId, useRag, temporary } = await req.json();

  const upstream = await fetch(`${process.env.BACKEND_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: forwardHeaders(req.headers),          // pass ALL headers through
    body: JSON.stringify({
      model, agent_id: agentId,
      messages: toBackendMessages(messages),
      stream: true,
      thread_id: temporary ? undefined : threadId,  // temporary chat → no thread persistence
      use_rag: !!useRag,
    }),
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await pumpBackendSse(upstream.body!, writer);  // §3
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { 'X-Accel-Buffering': 'no' },
  });
}
```

`forwardHeaders` copies every inbound header except hop-by-hop ones. No `X-User-ID` logic (auth dropped).

---

## 3. The transformer — `lib/chat/pump-backend-sse.ts`

Reads the backend SSE line-by-line, and for each `data: {json}` decides the chunk class by **which top-level keys are present**, then writes AI SDK parts. Maintain a little state machine:

- `textOpen: boolean` — whether a `text-start` has been emitted for the current assistant turn (the output agent).
- `reasoningOpen: boolean`.
- `openToolCalls: Map<index, {id,name,argsBuf}>`.
- `agentStreams: Map<agentName, {step, buf}>` — accumulates sub-agent text for the `agent-stream` data part (keyed `id`, so the client merges updates).

### Branch table

| Detect (keys present) | Backend meaning | Emit (AI SDK writer) |
| --- | --- | --- |
| `choices[].delta.content` | output-agent text delta | open text part once (`text-start` w/ stable id), then `text-delta` |
| `choices[].delta.reasoning` *(after backend change / proxied models)* | reasoning delta | `reasoning-start` once, then `reasoning-delta`; `reasoning-end` on first non-reasoning content |
| `choices[].delta.tool_calls[]` | tool call (streamed args) | `tool-input-start` {toolCallId,toolName} on first sight, `tool-input-delta` per args chunk; on `finish_reason:"tool_calls"` → `tool-input-available` with parsed args |
| `agent_event` `{agent,type,content,step}` | **sub-agent** text | append to `agentStreams[agent]`; `writer.write({type:'data-agent-stream', id: agent, data:{agent,step,text: buf}})`. `type:"text_done"` closes it. |
| `agent_progress` `{phase,message,agent?,step?}` | status / lifecycle | if `phase` ∈ {`agent_start`,`agent_done`} → `data-agent-step` {agent,step,status}; else → `data-agent-progress` (transient: true) |
| `tool_result` `{toolCallId,toolName,result}` | tool output | `tool-output-available` {toolCallId, output: result} |
| `tool_interrupt` `{toolCallId,toolName,prompt,details}` | HITL pause | `data-tool-interrupt` {…}; stream then ends — client renders approve/deny → `POST /v1/agent/resume` |
| `ag_ui.type` ∈ {`RUN_STARTED`,`RUN_FINISHED`,`STEP_STARTED`,`STEP_FINISHED`} only | run/step lifecycle | usually redundant with above; use `STEP_*` as fallback for `agent-step` if `agent_progress` missing |
| `ag_ui` CUSTOM `name:"task_list"` *(after backend change)* | task/todo update | `data-task-list` {tasks} |
| `ag_ui` CUSTOM `name:"artifact"` *(after backend change)* | artifact | `data-artifact` {…} |
| `usage` populated, or CUSTOM `name:"context_usage"` *(after backend change)* | usage/context | `data-usage` {…} |
| `[DONE]` | end | close any open text/reasoning parts; return |

Notes:
- **Transient vs persistent**: `agent-progress` is `transient: true` (ephemeral status, not stored on the message). `agent-stream`, `agent-step`, `task-list`, `artifact`, `usage`, and `tool-interrupt` persist so they survive reload of a saved thread.
- **Keyed data parts**: pass a stable `id` (e.g. agent name for `agent-stream`, artifact id for `artifact`, a constant for `task-list` so the latest snapshot replaces the prior) — the AI SDK merges same-id data parts client-side, which is exactly how we get a live-updating agent panel and a single evolving task list.
- **Robustness**: tolerate partial JSON lines (buffer until newline), unknown chunk shapes (ignore), and the extra top-level `thread_id` on OpenAI chunks (capture into message metadata on first sight).

---

## 4. Client wiring — `useChat`

```ts
// components/chat/use-agent-chat.ts
const { messages, sendMessage, status, addToolResult } = useChat<ChatMessage>({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
```

When sending, attach the current selection from the Zustand store into the request body:

```ts
sendMessage(
  { text, files },
  { body: { agentId, model, threadId, useRag, temporary } }
);
```

### Rendering `message.parts`

Iterate `message.parts` and switch on `part.type`:

| `part.type` | Renderer | AI Element used |
| --- | --- | --- |
| `text` | markdown answer | `MessageResponse` (Streamdown: code+LaTeX+mermaid already wired) |
| `reasoning` | collapsible thinking | `components/ai-elements/reasoning.tsx` |
| `dynamic-tool` / `tool-*` | tool call + result | `components/ai-elements/tool.tsx` |
| `data-agent-step` / `data-agent-stream` | **agent cards** (see below) | custom, built on `components/ai-elements/agent.tsx` + `Task`/`ChainOfThought` |
| `data-agent-progress` | inline status shimmer | `components/ai-elements/shimmer.tsx` |
| `data-tool-interrupt` | approve/deny | `components/ai-elements/confirmation.tsx` |
| `data-task-list` | todo list **above input** (not inline) | `components/ai-elements/task.tsx` / `plan.tsx` |
| `data-artifact` | open in right sidepanel | `components/ai-elements/artifact.tsx` |
| `data-usage` | feeds context circle + usage panel | custom |

`data-task-list` and `data-usage` are lifted out of the inline message flow: the task list renders in a docked bar above the chat input, and usage feeds the header context circle / sidepanel. They still live on the message so they persist, but the renderer routes them to those surfaces.

---

## 5. Multi-agent cards + per-agent sidepanel

This is the headline interaction. From the stream we get, per sub-agent: `data-agent-step` (started/done) and `data-agent-stream` (live text, keyed by agent name).

- Group all `data-agent-step` + `data-agent-stream` parts of a message by `agent`.
- Render **one card per agent** (`AgentCard`, built on `ai-elements/agent.tsx`): header = agent name + status (running spinner / done check), body = progress steps (each tool call/result and `agent_progress` message attributed to that agent, rendered with `ai-elements/task.tsx` or `chain-of-thought.tsx`).
- **Click a card** → set Zustand `sidepanel = { kind: 'agent', agent }`. The sidepanel renders that agent's full streamed response (`data-agent-stream` for that key) via `MessageResponse`, updating live for in-flight agents. Ideal for multi-agent (`deep-research`) workflows where you want to drill into one worker.

The **output/final agent** is not a card — its `text` part is the main answer rendered in the conversation body.

---

## 6. Context-usage circle (opencode-style)

- A circular progress indicator in the chat header / near the input: fraction = `contextUsed / contextWindow`.
- Source: latest `data-usage` part for the thread. Until the backend emits usage (see `02`), estimate `contextUsed` client-side with `tokenlens` over the current messages, and read `contextWindow` from the selected model's `context_length` (`/v1/models`).
- **Click** → open the right sidepanel (`sidepanel = { kind: 'usage' }`) showing a breakdown: system prompt, message history, tool results, RAG context, and per-turn token deltas — mirroring opencode's web UI. Breakdown comes from `data-usage.breakdown` when available, else estimated buckets.
