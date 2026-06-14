# Wire protocol decision — AG-UI vs AI SDK vs custom hybrid

Status: **analysis / decision pending** · Owner: Sam · Captured 2026-06-14

This document records the full analysis from the protocol discussion so the
decision can be revisited with all the reasoning intact. It supersedes the
loose "should we use AG-UI?" question — the answer depends on separating two
layers that were being conflated.

---

## 0. TL;DR

- **Two layers, not one.** *Wire protocol* (bytes on the network) is a separate,
  swappable decision from *render protocol* (the shape your components consume).
- Our **render protocol is AI SDK `UIMessage.parts`** — fixed by our choice of
  AI Elements + `useChat`. That was a deliberate, good call (performance +
  mature tooling). Keep it.
- Our **wire protocol today is a bespoke hybrid** (OpenAI chunks + custom
  `agent_event`/`agent_progress`/`tool_result` keys + a dead `ag_ui` sidecar),
  translated to AI SDK parts in the Next.js proxy (`lib/chat/pump-backend-sse.ts`).
- The real smell is **a third, invented protocol sitting between a backend and a
  frontend that already agree on the AI SDK parts model**, plus a redundant
  `ag_ui` field nobody reads.
- **Recommended fix:** have adk-go emit the **AI SDK UI Message Stream natively**.
  Keep `useChat` + AI Elements, delete the bespoke intermediate + the `ag_ui`
  sidecar, shrink the proxy to a thin auth/CORS shim. No adapter anywhere.
- **Do NOT go AG-UI-native** unless cross-vendor interop becomes a real product
  goal — it's a re-architecture, not a cleanup, and it costs us the AI Elements
  rendering bridge.
- **None of this is performance-driven** — runtime numbers are ~identical across
  all options. This is about protocol coherence and maintenance.

---

## 1. The core reframe: wire layer vs render layer

Every "AI SDK vs AG-UI" argument dissolves once you split these:

| Layer | What it is | Ours |
| --- | --- | --- |
| **Wire protocol** | the bytes crossing the network | bespoke hybrid (today) |
| **Render protocol** | the shape the React components consume | **AI SDK `UIMessage.parts`** (AI Elements binds to it) |

AI Elements (`Message`/`Response`/`Reasoning`/`Tool`/`Task`) bind to AI SDK
parts. That pins the **render** protocol. The **wire** protocol is independent —
it can be the custom hybrid, a native AI SDK stream, or AG-UI-with-an-adapter,
and the components never know the difference. The question "AI SDK or AG-UI?"
only feels like a dilemma because it crosses these two layers.

---

## 2. What AG-UI actually is (from the docs)

Source: https://docs.ag-ui.com/concepts/architecture

- AG-UI is **its own event protocol**, *not* an extension of OpenAI's SSE format.
  "Minimally opinionated," provider-agnostic.
- Agent contract: `run(input: RunAgentInput) -> Observable<BaseEvent>` — emit any
  of **16 standardized event types** as a stream.
- **Transport-agnostic**: HTTP SSE (text), a binary protocol (space-efficient),
  WebSockets, webhooks.
- Relationship to the LLM stream: a **middleware/adapter** translates native
  provider chunks (e.g. OpenAI) *into* AG-UI events. The `RAW` event type exists
  to **wrap** a provider-native event for passthrough.
- The 16 events:
  - **Lifecycle:** `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `STEP_STARTED`, `STEP_FINISHED`
  - **Text:** `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`
  - **Tools:** `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END` (+ `TOOL_CALL_RESULT`)
  - **State:** `STATE_SNAPSHOT`, `STATE_DELTA`, `MESSAGES_SNAPSHOT`
  - **Special:** `RAW`, `CUSTOM`

**Key correction to a common mental model:** you do **not** "add AG-UI on top of
an OpenAI SSE stream." AG-UI is the *outer* protocol; the OpenAI stream is the
raw LLM output that gets *translated into* (or wrapped by) AG-UI. Direction is
`OpenAI chunk → adapter → AG-UI event`. An "AG-UI SSE stream" looks like SSE
(`data: {…}\n\n`) but every frame is an AG-UI event with a `type` discriminator —
not a `chat.completion.chunk`. Same transport, different vocabulary.

AG-UI's payoff is **cross-vendor interop**: any AG-UI client (CopilotKit, etc.)
can talk to any AG-UI agent, and vice versa. We have one bespoke frontend talking
to one bespoke backend → interop dividend ≈ 0 today.

---

## 3. Current state (what's actually on the wire)

Backend: `~/code/agentic`. Frontend: this repo.

- adk-go emits **OpenAI-compatible chunks** for the output agent's text/reasoning/
  tool calls, **plus custom wrapper events** for multi-agent orchestration:
  `agent_event` (sub-agent reasoning/text/tool), `agent_progress` (phases +
  lifecycle), `tool_result`, `tool_interrupt`.
- Every wrapper event *also* carries a parallel `ag_ui` field
  (`*AGUIEvent`, `internal/types/events.go`) with the canonical AG-UI vocabulary
  (`RUN_STARTED`/`STEP_STARTED`/`TEXT_MESSAGE_CONTENT`/`THINKING_TEXT_MESSAGE_CONTENT`/
  `TOOL_CALL_START`/`TOOL_CALL_RESULT`/`STATE_SNAPSHOT`, plus `threadId`/`runId`/
  `messageId`).
- The proxy (`lib/chat/pump-backend-sse.ts`) parses the **custom keys + OpenAI
  chunks** and ignores the `ag_ui` field — *except* bare `ag_ui` CUSTOM events
  (`task_list`/`artifact`/`context_usage`), which it does read.

**Net:** ~three representations maintained (OpenAI chunks, custom keys, `ag_ui`
sidecar); the `ag_ui` field is **dead weight** — neither valid standalone AG-UI
(wrong shape: it rides *alongside* OpenAI chunks instead of replacing them) nor
consumed by the frontend.

### Why the custom events exist (and why they weren't the mistake per se)
Vanilla OpenAI SSE has **no vocabulary** for sub-agents, steps, or progress.
Multi-agent orchestration *requires* a richer stream. So extending was correct.
The mistake was extending toward a **one-off bespoke format + a vestigial AG-UI
sidecar**, rather than toward a protocol the frontend already speaks.

---

## 4. Why keep the AI SDK at all (the "we define custom events anyway" worry)

Defining custom `data-*` parts is the **cheap** part. The AI SDK's value is the
machinery *underneath* them, which we'd otherwise hand-roll:

- **Stream assembly** — flat chunks → ordered `message.parts[]`: concatenating
  `text-delta`→text, `reasoning-delta`→reasoning, accumulating tool-call arg
  deltas, start/end framing, part ordering.
- **`useChat` lifecycle** — submitted/streaming/ready/error, stop, regenerate,
  resume, transport + abort.
- **Throttled re-renders** so token streaming doesn't thrash React.
- **AI Elements** — components that render those parts, incl. streaming markdown
  via memoized Streamdown.

Custom `data-agent-*` parts ride *through* all of that for free. Custom data
parts are the SDK's **intended extension point** — using them is idiomatic, not
a workaround. So "is there a point to the SDK if we add custom events?" — yes,
the custom events are trivial; the assembly + lifecycle + rendering is the value.

---

## 5. The options

### Option A — Status quo (bespoke hybrid → proxy → AI SDK)
- **Keep:** everything works today.
- **Cost:** maintain a one-off wire format + dead `ag_ui` sidecar; the proxy owns
  a non-trivial translation; two/three representations can drift.
- **Verdict:** functional, but carries the smell.

### Option B — adk-go emits the AI SDK UI Message Stream natively ✅ RECOMMENDED
The AI SDK UI Message Stream is a **documented wire format** any backend can
produce (`data: {"type":"text-delta",...}` / `{"type":"data-agent-step",...}` SSE
frames).
- **Keep:** `useChat` + AI Elements unchanged; render protocol never moves, so
  streaming markdown / reasoning / tools / agent steps keep working verbatim.
- **Win:** no bespoke intermediate protocol; delete the `ag_ui` sidecar; proxy
  shrinks to a thin auth/CORS shim (or disappears); agent events become
  first-class `data-agent-*` parts emitted straight from Go; **no adapter
  anywhere** — Go speaks `useChat`'s own language.
- **Cost:** backend rework to emit the AI SDK stream shapes (move the proxy's
  translation logic into Go); re-verify the deep-research multi-agent shapes.
- **Verdict:** the coherent version of "one protocol the frontend consumes,"
  given we've committed to AI SDK rendering.

### Option C — adk-go emits AG-UI, frontend uses `@ag-ui/client`
- **Win:** standards-compliant; cross-vendor interop (CopilotKit, third-party
  AG-UI agents).
- **Cost:** **lose `useChat` and the AI Elements binding** — `@ag-ui/client` has a
  different message/state model. Rebuild the rendering bridge (or adopt
  CopilotKit components). Partly replaces the Vercel AI SDK transport the whole
  UI is built on.
- **Verdict:** only if interop is a real goal. It's a re-architecture, not a
  cleanup.

### Option D — adk-go emits AG-UI, but keep `useChat` via a custom transport
- `useChat` accepts a pluggable `transport`; write one that reads AG-UI SSE and
  yields AI SDK chunks.
- **Reality:** that's the same translation work as today's proxy, just relocated
  client-side and reading AG-UI instead of the custom keys. You're maintaining an
  adapter to bridge two protocols that didn't need to differ.
- **Verdict:** the "have AG-UI on the wire but still want AI Elements" path always
  funnels back through an AG-UI→parts adapter. Only worth it if the wire *must* be
  AG-UI (interop) *and* you want to keep AI Elements.

---

## 6. `useChat` compatibility matrix

| Go emits | Frontend | `useChat`? | Adapter needed? |
| --- | --- | --- | --- |
| **AI SDK UI Message Stream** (B) | `useChat` directly | ✅ yes | ❌ none |
| Bespoke hybrid (A, today) | `useChat` + proxy | ✅ yes | ⚠️ yes (proxy) |
| **AG-UI** (D) | `useChat` + custom transport | ✅ yes | ⚠️ yes (AG-UI→parts) |
| **AG-UI** (C) | `@ag-ui/client` | ❌ no | — (loses AI Elements) |

`useChat` consumes exactly one wire format natively: the AI SDK UI Message
Stream. "Go speaks AG-UI" and "use `useChat` directly" are mutually exclusive
unless you reintroduce a translator (rows C/D).

---

## 7. Performance analysis (spoiler: not the deciding factor)

### Removing the Next.js proxy
The proxy is a **streaming pass-through**, not a buffer: per event it does a
`JSON.parse` + a few `writer.write` calls (microseconds) and forwards on each
`\n\n`.
- **Saves:** one network hop of latency (browser→Next→backend ⇒ browser→backend).
  Co-located ≈ low single-digit ms; cross-region ≈ 10–40ms. Affects *time-to-first-
  token only*; negligible against multi-second model inference.
- **Saves:** a trickle of server CPU/RAM (O(1) per token, no accumulation).
- **Does NOT delete the transform** — it relocates it to the browser. Something
  still turns the stream into renderable parts.
- **Loses:** backend URL/token hiding, no-CORS-on-backend, no credential exposure.
  Most production setups keep a thin proxy for exactly these reasons.
- **Conclusion:** the proxy is not a bottleneck. Model inference rate dominates.

### AG-UI SSE vs AI SDK stream — wire perf
Both are `data: {json}\n\n` over an HTTP stream: same framing, same browser read
mechanics, comparable payloads. **No wire-level perf delta.** Caveats:
- AG-UI also offers a **binary transport** (more space-efficient than JSON) — a
  real but minor edge, and only if you used binary instead of SSE.
- The "AI SDK is more performant" intuition is about the **rendering layer**
  (`useChat` throttling + AI Elements memoized Streamdown), not the wire.

### Does the AI SDK support AG-UI / agent events?
- Core AI SDK speaks **its own** protocol; it does **not** natively ingest AG-UI.
- But it's extensible via `data-*` custom parts + `createUIMessageStream` —
  exactly what we use for `agent-step`/`agent-delta`/`agent-progress`. So the SDK
  doesn't "support AG-UI," but it fully supports *modeling agent events*.

---

## 8. Would going AG-UI-native break streaming / markdown? (Option C/D detail)

Not "break streaming" as a capability — AG-UI is fully streaming. But precisely
what survives vs. what gets rebuilt:

| | Going `@ag-ui/client` native (C) |
| --- | --- |
| Streaming as a capability | ✅ fine |
| **Streamdown** (markdown streaming) | ✅ survives — *but* it just renders a growing string; **accumulating `TEXT_MESSAGE_CONTENT` deltas into that string becomes our job** |
| AI Elements (Response/Reasoning/Tool/Task) | ❌ won't bind — expect AI SDK parts; adapt or replace (CopilotKit) |
| Part assembly, tool-arg accumulation, reasoning blocks | ❌ reimplement (or map from AG-UI message state) |
| `useChat` lifecycle, throttling, stop/regenerate/resume | ❌ rebuild |

Smooth streaming markdown/reasoning/tool UX is a property of **(AI SDK assembly +
AI Elements)**, not free-standing. Dropping the SDK doesn't *break* it — it means
re-earning it.

---

## 9. Decision & rationale

**Recommended: Option B — adk-go emits the AI SDK UI Message Stream natively.**

Rationale, in one line: *don't invent a third protocol between a backend and a
frontend that already agree on the AI SDK parts model — make the wire speak that
model end to end.*

- Keeps the rendering ergonomics we deliberately chose (perf + tooling).
- Removes the bespoke hybrid + dead `ag_ui` sidecar (one source of truth).
- Keeps `useChat` with **zero** adapter.
- Performance is a wash, so this is a coherence/maintenance win, not a regression
  risk.

**Revisit Option C (AG-UI-native) only if** a concrete interop requirement
appears: exposing this agent to CopilotKit / other AG-UI clients, or consuming
third-party AG-UI agents from this UI. At that point, stand up a **separate,
clean AG-UI endpoint** (`/agui` emitting the 16 events) *in addition to* the AI
SDK stream — do not smear AG-UI across the OpenAI stream again.

---

## 10. If we proceed with Option B — implementation sketch (not yet started)

Scope is a backend rework + a proxy shrink; frontend render code is largely
untouched.

1. **adk-go: emit the AI SDK UI Message Stream directly.**
   - Output agent text/reasoning/tools → `text-start`/`text-delta`/`text-end`,
     `reasoning-*`, `tool-input-start`/`-delta`/`-available` + `tool-output-available`.
   - Multi-agent events → `data-agent-step` / `data-agent-delta` (with `kind`) /
     `data-agent-progress` (with `agent`), matching `lib/chat/types.ts ChatDataParts`.
   - `task_list` / `artifact` / `usage` → the corresponding `data-*` parts.
   - `message-metadata` for model/agent/duration.
   - **Delete the `ag_ui` sidecar** from `internal/types/events.go` + `stream.go`.
2. **Proxy: shrink `pump-backend-sse.ts`.** With Go emitting the AI SDK stream,
   the route becomes a pass-through (auth/CORS, inject metadata) or is removed in
   favor of `DefaultChatTransport` pointing at the backend (if auth allows).
3. **Frontend:** essentially unchanged — `useChat`, AI Elements, the agent
   cards/side-panel redesign all keep working because the render protocol didn't
   move. Verify `ChatDataParts` matches the Go-emitted shapes exactly.
4. **Verify:** deep-research multi-agent run + DeepSeek end-to-end against real
   OpenSearch/Valkey; confirm streaming markdown/reasoning/tool/agent-step UX
   identical to today.

### Open questions for revisit
- Auth model if the proxy is fully removed (token exchange vs. keep a thin shim).
- Does adk-go's SSE writer cleanly support emitting arbitrary AI SDK part frames,
  or does the OpenAI-compat layer get in the way?
- Keep the proxy as a thin shim regardless (for secret-hiding/CORS), even under B?
  Likely **yes** — the hop cost is negligible and it keeps backend creds server-side.

---

## 11. Cross-references
- `plans/01-streaming-architecture.md` — original streaming/branch design.
- `plans/agent-ui-redesign.md` — the multi-agent card/side-panel redesign (done;
  unaffected by this decision).
- `lib/chat/pump-backend-sse.ts` — current proxy translation (the thing that
  shrinks under Option B).
- `lib/chat/types.ts` — `ChatDataParts` (the render-protocol contract Go must
  match under Option B).
- `~/code/agentic/internal/types/events.go`, `internal/agent/stream.go` — backend
  event shapes + the `ag_ui` sidecar to delete.

---

## 12. Reference: how opencode does it (third data point)

Captured 2026-06-14 from the opencode source. NOTE: `github.com/sst/opencode`
now redirects to **`github.com/anomalyco/opencode`** (still the public
`opencode.ai` / npm `opencode-ai` project; default branch `dev`). Bun/TypeScript
monorepo using Effect + Drizzle/SQLite. The live web/SDK uses a legacy
event-sourced **v1** schema (`packages/core/src/v1/session.ts`) wrapped by a
**v2** orchestration layer (`packages/opencode/src/session/message-v2.ts`).

Included here as a comparison point for the §5 options — opencode is a **third
answer** to the protocol question, distinct from all four of ours.

### 12.1 Protocol
opencode uses its **own custom, event-sourced event protocol over an SSE
`/event` endpoint** — *not* OpenAI SSE chunks, *not* the Vercel AI SDK UIMessage
stream, *not* AG-UI. (The Vercel AI SDK is used internally only to *call models*
+ `convertToModelMessages`; it never reaches the wire to clients.)

- `GET /event` (`packages/opencode/src/server/routes/instance/httpapi/groups/event.ts`)
  emits JSON events `{ id, type, properties }` from an in-process bus, opening
  with `server.connected` and a 10s `server.heartbeat`.
- The bus (`packages/core/src/event.ts`, `EventV2`) is **durable + event-sourced**:
  "sync" events persist to SQLite (`EventTable`, monotonic `seq` per `sessionID`),
  run through projectors into read-model tables, then publish. Supports
  `replay`/`replayAll` + per-aggregate cursors.
- Session/message/part events in `v1/session.ts:573-632`:
  `session.created/updated/deleted`, `message.updated`, `message.removed`,
  `message.part.updated` (carries the **full Part**), `message.part.removed`,
  plus `message.part.delta` (`message-v2.ts:61`) for incremental text.
- Frontend consumes via a **generated typed SDK** (`packages/sdk/js`,
  `client.event.subscribe()` → `get.sse(...)`). The interactive client is the
  **TUI** (`packages/tui`, SolidJS-on-terminal); `packages/web` is the
  marketing/docs site + a read-only **share viewer**.

### 12.2 Streaming model — snapshot-replace vs our append-delta
The canonical channel is a **whole-Part snapshot**: `session.updatePart(part)`
publishes `message.part.updated` carrying the *entire current Part*, which the
client **replaces** (projectors persist it to `PartTable`). A finer
`message.part.delta` exists for token-level text, but the authoritative,
replayable unit is the full part.

| | opencode | us |
| --- | --- | --- |
| Wire | custom event-sourced SSE | hybrid → proxy → AI SDK stream |
| Unit | whole-part snapshot (replace) + durable log | append-only token deltas, assembled by `useChat` |
| Replay / multi-client | first-class (SQLite log + cursors) | not native (single client, ephemeral) |
| Driver | TUI **+** web share **+** resume ⇒ needs persistence/sync | one web client + streaming-markdown ergonomics |

Reinforces the §0 thesis: **no universal standard** — client topology dictates
the protocol. opencode needs multi-client persistence/replay → event-sourced
snapshots. We have one client + want AI Elements ergonomics → AI SDK parts.

### 12.3 Part taxonomy (`v1/session.ts:359-372`)
Discriminated union of **12** types, all sharing `{id, sessionID, messageID}`:
`text, reasoning, file, tool, step-start, step-finish, snapshot, patch, agent,
retry, compaction, subtask`. `tool` carries a 4-state lifecycle
(`pending / running / completed / error`, `:298`). Todos are **out-of-band
session state**, not a part.

### 12.4 Agent / sub-agent handling — the key contrast
- **A sub-agent is a CHILD SESSION, not inlined parts.** The model calls a
  **`task` tool** (`packages/opencode/src/tool/task.ts`) →
  `sessions.create({ parentID, agent })`; the child gets its own message/part
  tree. Linkage is **`session.parentID`** (+ a `subtask` marker part on the
  child's first user message, `prompt.ts:1500-1512`).
- **Attribution is free** — the parent references the child only via an ordinary
  **`tool` part with `tool: "task"`**, whose `metadata` holds the child
  `sessionId` + model + final output (`task.ts:171-199`). Nothing can leak into
  the parent because the sub-agent's work lives in a different session.
- **Agents** (`packages/opencode/src/agent/agent.ts:135-263`): `build` (primary
  default), `plan` (primary), `general` (subagent), `explore` (subagent,
  read-only tools) — each `Agent.Info` has `mode: "primary"|"subagent"`, own
  prompt/model/tools/permissions. "Mode vs agent" is unified (mode is a field on
  the agent). The pasted `agent:"explore"` = the read-only exploration subagent.
- **UI:** parent shows the `task` tool summary inline + a **"view subagents"**
  drill-down navigating *into* the child session's full transcript (TUI,
  `routes/session/index.tsx:1507-1527,2224`); the share viewer renders
  final-output-only (`web/.../share/part.tsx:702`).
- **Todos** (`tool/todo.ts` + `session/todo.ts`): separate session-scoped state in
  `TodoTable`, broadcast via a dedicated **`todo.updated`** event — NOT a part.
  `Todo.Info = {content, status: pending|in_progress|completed|cancelled,
  priority: high|medium|low}` — matches our `data-task-list` shape.

### 12.5 Why our design differs (and where it's fine)
The decisive difference: **opencode's sub-agents are LLM-initiated** (the model
calls `task`), so a tool-call/child-session model is natural and attribution is
free. **Our deep-research sub-agents are a deterministic server-side pipeline**
(planner → analysts → report) orchestrated in Go — no `task` tool branches, so no
natural child session, and we attribute events manually (the source of the
"sub-agent error leaks into top-level" bug we fixed in `agent-ui-redesign.md`).

Takeaways:
1. **Our inlined-card model is correct for the fixed pipeline** — those
   sub-agents are stages of one run, not independent navigable sessions. No
   change. (Matches the earlier "render steps inside the top-level agent, they
   feel different from todos" decision.)
2. **Convergence:** our "click agent card → side-panel streams that agent's full
   output" is conceptually opencode's "view subagents" drill-down — just
   reconstructed from inlined parts instead of a persisted child session.
3. **Pattern worth stealing IF we ever add general (non-pipeline) agents that
   dynamically spawn helpers:** model "spawn sub-agent" as a **`task` tool call**
   → attribution becomes free, side-panel becomes "open the child session."
   Doesn't apply to the current fixed pipeline.
4. **Todos already aligned** with opencode's status/priority shape; the only
   difference is out-of-band state vs our keyed snapshot part — both
   replace-on-update, functionally equivalent for one client.

### 12.6 opencode reference files (under a fresh clone of `anomalyco/opencode`)
- `packages/core/src/v1/session.ts` — message + part + event schema.
- `packages/core/src/event.ts` — event-sourced bus.
- `packages/opencode/src/session/message-v2.ts` — v2 wrapper + AI-SDK conversion.
- `packages/opencode/src/session/{session.ts,processor.ts}` — updatePart/publish,
  model-stream → part translation.
- `packages/opencode/src/server/routes/instance/httpapi/{handlers,groups}/event.ts`
  — `/event` SSE.
- `packages/opencode/src/tool/task.ts` — sub-agent spawn.
- `packages/opencode/src/agent/agent.ts` — agent/mode config.
- `packages/opencode/src/tool/todo.ts` + `session/todo.ts` — todos.
- `packages/sdk/js/src/gen/` — generated typed client + full event union.
- `packages/tui/src/routes/session/index.tsx`,
  `packages/web/src/components/share/part.tsx` — UI rendering.
