# Multi-agent UI redesign — plan

Addresses the three issues from testing deep-research. Backend = `~/code/agentic`, frontend = this repo.

## Root-cause findings (from stream.go analysis)

The backend's `agent_progress` event is **overloaded** and inconsistently attributed:

| Emitter | phases | `agent` field? | level |
| --- | --- | --- | --- |
| `writeProgress` (stream.go:452) | `planning`, `executing` (per tool call), **`error`** | ❌ none | run-level |
| `writeAgentProgress` (stream.go:470) | `agent_start`, `agent_done` | ✅ sub-agent | per-agent |

Plus:
- **Sub-agent text/reasoning** → `agent_event` (`text_delta` / `reasoning_delta`), carries `agent`+`step`. ✅ attributed.
- **Sub-agent tool calls/results** → emitted as an **unattributed** OpenAI `tool_calls` chunk + a run-level `executing` progress + an unattributed `tool_result`. ❌ the author is known server-side but **dropped from the wire**.
- **Sub-agent errors** → `writeProgress(…, "error", …)` = run-level, no agent (stream.go:221-225). ❌
- **task_list** → one task per name in `core.SubAgentNames` (the flat YAML list). Misses the code-agent steps (`rag_retrieval`, `document_loop`, …) and the per-document loop; not plan-derived.

So: the frontend collects ALL `agent_progress` into the top-level `RunProgress`, which is why the **sub-agent error + tool-execution lines show at the top level** (issue 1), the **task list is just the static sub-agent names** (issue 2), and the **card shows the streamed text** instead of per-agent steps (issue 3).

---

## Issue 1 — sub-agent error leaks into top-level steps

**1a (env):** `opensearch ... connection refused` — the deep-research RAG/DB tools need OpenSearch+Valkey (Docker). Not a code bug. → start `docker compose up -d opensearch valkey` for a real run.

**1b (attribution):** the error is emitted run-level. **Fix:**
- **Backend:** at the error site (stream.go:221-225) route through `writeAgentProgress(…, "error", msg, lastAuthor, step)` so the failure is attributed to the failing sub-agent (`lastAuthor` is in scope). Likewise attribute the `executing`/"Running X…" progress to the active `author` (stream.go:372) instead of run-level.
- **Frontend:** the top-level `RunProgress` renders only **run-level** progress (`planning`, orchestrator transitions). Per-agent `executing`/`error` move into that sub-agent's card (issue 3). Errors render as a distinct error chip, not a normal step.

---

## Issue 2 — dynamic task list (opencode-style)

opencode uses a `todowrite` **tool** the LLM calls with a full `{content,status,priority}[]` snapshot. But for a **fixed pipeline** (planner → analysts → report) the research recommendation is **server-owned**, not LLM-owned (avoids hallucinated/stale tasks):

- **Option A (recommended, moderate):** the orchestrator emits the task list from **actual stage transitions** — one task per stage as it really runs (including code agents + the per-document loop), statuses flipping `pending → in_progress → completed`, exactly-one-active by construction. Deterministic, reflects reality. Backend-only change (drive `task_list` from real `transitionAgent` authors instead of the static `SubAgentNames`).
- **Option B (richer, larger):** have `research_planner` emit **structured JSON** (focus areas / sub-tasks); the orchestrator expands the task list from it → genuinely "dynamic" per the planner's decision. Needs a structured plan schema + parsing (today the plan is unparsed free-text in session state).
- **Option C (opencode-exact):** give the orchestrator a `todowrite` tool. Not recommended here — the pipeline shape is known, so an LLM-owned list just adds hallucination/duplication risk.

**Transport:** keep the existing `task_list` CUSTOM snapshot (simple, idempotent) — no need for AG-UI STATE_DELTA yet.

→ **Recommend Option A now**, with B as a follow-up once we want the list to reflect the planner's chosen focus areas. Frontend `TaskBar` already renders `data-task-list`; it just gets better data.

---

## Issue 3 — agent card = step log; side panel = full output

**Target behaviour:**
- **Sub-agent card** shows that agent's **progress steps** (thinking → running tool X → done / error), **expanded by default** — not the streamed text.
- **Click card → side panel** streams that agent's **full output: reasoning at the top, then the answer text**, markdown-rendered.

**Backend changes** (to make per-agent steps real):
- Attribute sub-agent **tool calls/results** to the sub-agent. Cleanest: when `author != outputAgent`, route the FunctionCall/FunctionResponse through `agent_event` with new types `tool_call` / `tool_result` carrying `agent`, tool name, args/result (instead of the unattributed OpenAI `tool_calls` chunk). The output agent's tools stay on the main-thread OpenAI channel as today.
- (From issue 1b) attribute `executing`/`error` progress to the active agent.

**Frontend changes:**
- **Transformer (`pump-backend-sse.ts`):**
  - `data-agent-delta`: add `kind: "reasoning" | "text"` (already known from `agent_event.type`) so the panel can show reasoning separately.
  - New `data-agent-progress` rows now carry `agent` (per-agent steps): planning/executing/error/tool messages keyed to a sub-agent.
  - Map the new sub-agent `tool_call`/`tool_result` `agent_event`s into per-agent step entries.
- **`AgentCards`:** render each sub-agent as a card containing a **step log** (its `data-agent-progress` + tool steps + start/done, with an error state), expanded by default; click sets the sidepanel. (Drop the trailing-text preview.)
- **Right panel `AgentView`:** reconstruct the agent's stream split by `kind` — a **Reasoning** block (collapsible, top) from `kind:"reasoning"` deltas, then the **answer** from `kind:"text"` deltas — both via the same `MessageResponse`/`Reasoning` AI-elements used in the main thread.
- **`RunProgress` (top-level):** keep only run-level orchestrator progress; per-agent detail now lives in the cards.

**Data-model summary (frontend `types.ts`):**
- `agent-delta` → `{ agent, step, kind: "reasoning" | "text", delta }`
- `agent-progress` → `{ phase, message, agent? }` (agent now populated for per-agent steps)
- (optional) `agent-tool` → `{ agent, toolName, status }` if we prefer a dedicated tool-step part over folding tools into `agent-progress`.

---

## Proposed build order (after sign-off)

1. **Backend** (`~/code/agentic`): (a) attribute error + executing progress to the active sub-agent; (b) route sub-agent tool calls/results through attributed `agent_event`s; (c) Option A dynamic task list from real transitions. `go build`/`vet` + verify event shapes.
2. **Frontend transformer**: `kind` on agent-delta, per-agent progress/tool steps.
3. **Frontend rendering**: AgentCards step-log (expanded), AgentView reasoning+text, RunProgress run-level-only, TaskBar (no change, better data).
4. Bring up Docker (OpenSearch+Valkey) and run deep-research + DeepSeek end-to-end.

## Open decisions for you
1. **Task list:** Option A (server-driven, real stages) now — agree? Or go straight to B (plan-derived)?
2. **Sub-agent tool steps:** OK to add backend attribution for sub-agent tool calls (needed for meaningful card steps)? Without it, card steps are limited to thinking/generating/done/error.
3. **Start Docker** (OpenSearch+Valkey) so the deep-research test is real?
</content>
