# 02 — Backend Changes (`~/code/agentic`)

These changes make four requested features real end-to-end. They are additive — they emit **new** SSE events alongside the existing OpenAI/AG-UI hybrid stream, so they never break the current proxy or non-agent paths. Each new event rides the existing `ag_ui` CUSTOM envelope or populates the OpenAI chunk, so the frontend transformer (`01-streaming-architecture.md §3`) is the only consumer that needs to know about them.

All line refs are from the analysis of the current tree; re-confirm before editing.

---

## A. Reasoning / thinking deltas

**Problem:** `internal/agent/stream.go` (~lines 202–335) iterates `genai.Part` and only handles `part.Text`, `part.FunctionCall`, `part.FunctionResponse`. Thought parts are dropped. Proxied (non-agent) models already pass `delta.reasoning` through, so only the agent path is missing.

**Change:**
1. In the part loop, detect thought content. ADK `genai.Part` exposes thinking via `part.Thought` (bool) and/or a thought-tagged text — verify against `google.golang.org/genai v1.40.0` (`genai.Part`). When the active part is a thought:
   - **Output agent**: emit an OpenAI chunk with `choices[0].delta.reasoning = <text>` (OpenRouter-compatible field; the frontend maps it to a native `reasoning` part). Add a `reasoning` field to the delta encoder in `internal/sse/encoder.go` (alongside `TextDelta`), e.g. `cb.ReasoningDelta(text)`.
   - **Sub-agents**: emit an `agent_event` with `type:"reasoning_delta"` (carry `agent`, `step`, `content`), and set its `ag_ui.type:"THINKING_TEXT_MESSAGE_CONTENT"` (or CUSTOM `name:"reasoning"`). The frontend already attributes `agent_event` to the right agent card.
2. Ensure thinking is **requested** upstream: confirm `reasoning_effort` / `convertThinkingLevel` (`pkg/genai/openai/openai.go`) is set for reasoning-capable models so the provider actually returns thoughts.

**New wire shapes:**
```jsonc
// output agent
{"choices":[{"delta":{"reasoning":"Let me consider..."}}], "thread_id":"..."}
// sub-agent
{"agent_event":{"agent":"research_planner","type":"reasoning_delta","content":"...","step":1},
 "ag_ui":{"type":"THINKING_TEXT_MESSAGE_CONTENT","delta":"...","messageId":"research_planner-1"}}
```

---

## B. Usage + context tokens

**Problem:** the agent streaming path (`stream.go`, `nonstream.go`) emits **no** usage. The OpenAI chunk type can carry `usage` but it's never populated; no `stream_options:{include_usage:true}`. `context_length` is known statically per model but used-context is never tracked.

**Change:**
1. Set `stream_options:{include_usage:true}` on upstream LLM calls (the ADK model wiring / `pkg/genai/openai`) so the provider returns a final usage chunk.
2. Capture usage from the ADK run result (prompt/completion/total tokens). For multi-agent runs, accumulate across agents.
3. Emit a **final usage event** just before `RUN_FINISHED` / `[DONE]`:
   - Populate `usage` on the terminal OpenAI chunk **and** emit a dedicated CUSTOM event so it's unambiguous:
```jsonc
{"ag_ui":{"type":"CUSTOM","name":"context_usage","value":{
   "prompt_tokens":1234,"completion_tokens":567,"total_tokens":1801,
   "context_used":1801,"context_window":131072,
   "breakdown":[{"label":"system","tokens":420},{"label":"history","tokens":900},
                {"label":"rag","tokens":300},{"label":"tools","tokens":181}]}}}
```
4. `context_window` = selected model's `context_length` from `models.yaml`. `context_used` = prompt tokens of the final turn (running context), not cumulative completion tokens. The `breakdown` is best-effort: bucket by message source (system prompt, prior messages, RAG-injected context, tool results).

Frontend maps this to the `data-usage` part → context circle + usage sidepanel. Until this lands, the frontend estimates via tokenlens.

---

## C. Task / todo list events (AG-UI)

**Problem:** no task-list events on the wire. The brief wants a todo list that renders above the input while the agent runs many actions.

**Change:** when an agent produces or updates a plan (the `deep-research` pipeline has a `research_planner`; other agents may emit a plan tool), publish the task list as a CUSTOM AG-UI event. Re-emit the **full snapshot** each time a task changes status (simplest for the frontend — keyed data part replaces prior):
```jsonc
{"ag_ui":{"type":"CUSTOM","name":"task_list","value":{"tasks":[
  {"id":"t1","title":"Plan research","status":"completed"},
  {"id":"t2","title":"Analyze documents","status":"in_progress"},
  {"id":"t3","title":"Generate report","status":"pending"}]}}}
```
Source the tasks from: (a) the planner agent's structured output if present, or (b) synthesize from `STEP_STARTED`/`STEP_FINISHED` of sub-agents (each sub-agent = one task). Option (b) is a zero-config win for multi-agent pipelines and can ship first.

Add the emission helper next to `writeAGUI`/`writeProgress` in `internal/agent/stream.go`.

---

## D. Artifact events (AG-UI)

**Problem:** no artifact events. The brief wants the agent to push artifacts into the sidepanel on request.

**Change:** add an `emit_artifact` capability — either a built-in tool the agents can call, or detection of fenced artifact blocks in output. Emit:
```jsonc
{"ag_ui":{"type":"CUSTOM","name":"artifact","value":{
  "id":"a1","title":"Q3 Summary","kind":"markdown","language":null,"content":"# ..."}}}
```
`kind` ∈ {`markdown`,`code`,`html`,`json`}. For code, set `language`. Re-emit same `id` to update (keyed data part). Frontend routes `data-artifact` to the sidepanel (`ai-elements/artifact.tsx`).

Minimum viable: register an `artifact` tool in the agent tool registry whose invocation simply emits this event (no side effects) — agents opt in by calling it.

---

## E. File upload for RAG — **deferred (UI only)**

No backend change now. For reference, the eventual endpoint:
- `POST /v1/rag/documents` (multipart) → extract text → embed → index into OpenSearch under a per-thread or per-collection namespace.
- Chat then sets `use_rag:true` and scopes retrieval to that namespace.

The frontend builds the upload UI + a stubbed `POST /app/api/upload` (or direct stub) now; swap in the real endpoint later. Track as a follow-up.

---

## F. Auth / headers — simplification

The brief drops auth. No backend code change required, but note for the frontend: the proxy forwards all headers and **does not** synthesize `X-User-ID`. Threads/memories will scope to the backend default (`"anonymous"`). Acceptable for now; revisit when SSO is added.

---

## Summary of new SSE events for the frontend transformer

| `name` / field | Trigger | Frontend part |
| --- | --- | --- |
| `delta.reasoning` (OpenAI chunk) | output-agent thinking | native `reasoning` |
| `agent_event.type:"reasoning_delta"` | sub-agent thinking | `data-agent-stream` (reasoning lane) |
| CUSTOM `context_usage` + chunk `usage` | end of run | `data-usage` |
| CUSTOM `task_list` | plan created/updated | `data-task-list` |
| CUSTOM `artifact` | agent emits artifact | `data-artifact` |

All additive; existing chunks unchanged.
