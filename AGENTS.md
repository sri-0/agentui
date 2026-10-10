<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — `agentui`

The web frontend for the **`agentlite`** Go backend (`~/code/agentlite`). A Next.js 16
App Router app that renders a corporate, multi-agent LLM chat: streaming
markdown answers, per-sub-agent cards that open the child's live thread,
reasoning, tool calls, human-in-the-loop approvals and questions, task lists,
artifacts, and a live context-usage ring.

- **Stack**: Next.js `16.2.9` (App Router) · React `19.2.4` · `@ag-ui/core`
  (event types) · TanStack Query `5` · Zustand `5` · Tailwind v4 · shadcn
  (style `radix-nova`) · AI Elements + streamdown (rendering) · `ai` as a
  **types-only** dependency (the AI SDK part shapes the AI Elements components
  take) · `@xyflow/react`, `rive`, `motion` (graph/animation, mostly latent).
- **Backend contract**: the browser talks **directly** to the Go backend: REST
  for threads/agents/models and one **WebSocket** (`/v1/agent/chat?v=1`) that
  streams **AG-UI** events for every open thread. There is no Next.js proxy and
  no AI SDK runtime: `lib/chat/reduce.ts` folds the events into the view model.

> Read alongside `~/code/agentlite/docs/PLAN.md` (§3.3 events, §3.4 transport,
> Appendix B reducer table). That document is the source of truth for the
> events `lib/chat/reduce.ts` understands.

---

## 1. Quick start

```bash
pnpm install
cp .env.example .env.local       # NEXT_PUBLIC_API_URL (see §3)
pnpm dev                         # http://localhost:3000
pnpm build && pnpm start
pnpm lint
```

Requires the agentlite backend running (default `:8000`). Without it the thread
list query errors (the sidebar shows no conversations), opening a thread shows
the fetch error above the composer, and the socket keeps retrying with backoff.

---

## 2. App Router structure

```
app/
  layout.tsx              # root: Geist fonts + <Providers> (Query, Theme, Tooltip, react-scan)
  page.tsx                # redirect → /chat
  globals.css             # Tailwind v4 @theme, OKLCH tokens, .ai-gradient/.ai-glow helpers
  (app)/
    layout.tsx            # app shell: SidebarProvider + AppSidebar + SidebarInset
    chat/page.tsx         # <LandingView> — centered composer for new/temporary chats
    chat/[threadId]/page.tsx   # <ThreadView> — awaits params (Next 16), renders the chat
```

- Root + `(app)` layouts are **Server Components**; every interactive surface is
  `'use client'`.
- **No `app/api/*` routes** — all network calls go directly to the Go backend.
- Landing flow: typing on `/chat` creates a thread id (`nanoid`) and navigates to
  `/chat/[threadId]`; pending text is carried via `lib/chat/pending.ts` and sent
  once the (empty) history has loaded.

```
components/
  providers.tsx               # QueryClientProvider + ThemeProvider + single TooltipProvider
  chat/
    use-thread.ts             # useThread(threadId): the thread's state + send/approve/answer/stop (see §5)
    landing-view.tsx, thread-view.tsx (ThreadChat), task-bar.tsx, temporary-toggle.tsx
    composer/                 # composer, model-selector, agent-selector,
                              #   reasoning-effort-selector, thread-usage-ring, attachments
    messages/                 # message-list (+ pipeline step cards), tool-card, question-card,
                              #   agent-card, message-reasoning, message-actions, message-meta
  right-panel/                # right-panel, agent-view (child thread), artifact-view, usage-view, model-view, csv
  sidebar/app-sidebar.tsx     # thread list (grouped Today/Yesterday/7d/30d/Older) + run-status dots
  ai-elements/                # shadcn AI Elements registry (message, reasoning, tool, conversation, …)
  ui/                         # shadcn primitives (radix-nova)

lib/
  chat/  socket.ts (WebSocket) · reduce.ts (AG-UI events → view model) · store.ts (zustand threads) ·
         types.ts (ChatMessage/parts) · pending.ts · usage.ts · artifacts.ts · tasks.ts
  api/   client.ts (apiFetch) · agents.ts · models.ts · threads.ts · types.ts
  providers.ts · group-threads.ts · dayjs.ts · utils.ts
stores/ ui-store.ts            # Zustand UI state
hooks/  use-mobile.ts
plans/  00–06 + agent-ui-redesign.md   # design docs (see §9)
```

---

## 3. Environment & endpoints

| Var | Default | Used by |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | REST (`lib/api/client.ts`) and the WebSocket (`lib/chat/socket.ts`, `http` → `ws`) |

REST (TanStack Query / `apiFetch` in `lib/api/*`):
- `GET /v1/agents` → `{data: [{id, name, description, kind, mode, model, tools?, subagents?, system_prompt}]}`
- `GET /v1/models`
- `GET /v1/threads` → `{data: [{id, root_id, title, agent_id, model, created_at, updated_at, run_status?}]}`,
  polled every 5 s; `run_status` (`queued | running | awaiting_input`) drives the sidebar dots
- `GET /v1/threads/{id}/messages` → `{data: [{id, thread_id, role, seq, created_at, text, events}], cursor}`;
  `events` are the AG-UI events of that turn, `cursor` is the log id to `subscribe{after}` from (`""` when idle)
- `DELETE /v1/threads/{id}`

WebSocket `GET /v1/agent/chat?v=1` (`lib/chat/socket.ts`), one per tab:
- client → server: `run{threadId, message:{id, content}, agentId?, model?}`,
  `run{threadId, resume:[{interruptId, status:"resolved", payload}]}`,
  `subscribe{threadId, after?}`, `unsubscribe{threadId}`, `cancel{threadId}`
- server → client: `event{threadId, seq, event}`, `idle{threadId}` (no active run),
  `error{threadId, code, message}`
- a subscription ends at the segment's `RUN_FINISHED`/`RUN_ERROR`; a new `run` or
  `subscribe` for the same thread replaces the old one.

There is no identity header and no temporary mode: every thread is persisted.

---

## 4. The view model (`lib/chat/types.ts`, `lib/chat/reduce.ts`)

`reduce(thread, event)` is a pure function over `@ag-ui/core` events producing
`ThreadState = {messages, status, interrupts, cursor, loaded}`. Messages keep AI
SDK part shapes so the AI Elements components render them unchanged:

| AG-UI event | Part / state change |
|---|---|
| `RUN_STARTED{metadata:{turnId, agentId, model, createdAt}}` | opens the assistant message `id = turnId` (or continues it after a resume); status `streaming` |
| `STEP_STARTED/FINISHED{stepName}` | `step-start{agent, done}` marker |
| `TEXT_MESSAGE_START/CONTENT/END{messageId, role}` | `text` part keyed by `messageId` (`role: "user"` is the user turn; it replaces the composer's optimistic copy) |
| `REASONING_MESSAGE_START/CONTENT/END` + `REASONING_END` | `reasoning` part; `durationMs` from the timestamps |
| `TOOL_CALL_START/ARGS/END`, `TOOL_CALL_RESULT` | `dynamic-tool` part: `input-streaming → input-available → output-available \| output-error` (`{error}` results) |
| `ACTIVITY_SNAPSHOT{activityType, messageId, content}` | upserts `data-agent` / `data-task-list` / `data-artifact` by `messageId` |
| `SUBAGENT_FINISHED/ERROR{subagentRunId}` | status of the matching `data-agent` card |
| `CUSTOM{name:"approval", value:{toolCallId, approved, justification}}` | tool part `approval-responded` or `output-denied`, with `approval.reason` |
| `RUN_FINISHED{outcome, usage, metadata:{durationMs}}` | status `idle`, or `awaiting_input` with `interrupts` (a `confirmation` interrupt puts its tool part in `approval-requested`); usage + duration into `metadata` |
| `RUN_ERROR{message}` | status `error` |

Per-message `metadata`: `{agentId, model, createdAt, durationMs, usage:{inputTokens, outputTokens}, cancelled?, error?}`.
Data part payloads: `data-agent` is the backend's agent activity
(`subagentRunId, childThreadId, name, description?, status, startedAt, durationMs?, error?, progress?, log?, text?`),
`data-task-list` is `{tasks:[{id, title, status}]}`, `data-artifact` is `{id, title, kind, content, language?, url?, …}`.

---

## 4a. Event → part → component

Every AG-UI event the backend emits, what the reducer makes of it and which
component renders the resulting part is tabled in the backend repo at
`agentlite/docs/AG-UI-RENDERING.md`, next to the encoder that emits them.
`reduce.ts` is the only place events are interpreted; components only read
parts. Keep that document current when the encoder or the reducer changes.

## 5. Chat architecture

```
lib/chat/socket.ts   one WebSocket; per-thread subscriptions + last seq; jittered-backoff reconnect
                     re-subscribes every open thread from its last seq
lib/chat/store.ts    zustand: threads[threadId] = ThreadState; frames are reduced as they arrive and
                     published once per animation frame
use-thread.ts        useThread(threadId) → {messages, status, interrupts, loaded, error, send, approve, answer, stop};
                     opens the thread on mount, unsubscribes on unmount
  └─ ThreadChat  (re-renders once per published frame; children mostly bail)
       ├─ ThreadHeader (memo)
       ├─ MessageList  ← the intended re-render
       │     └─ MessageItem (memo on the message ref — the reducer shares untouched messages)
       │           ├─ text          → MessageResponse (streamdown)
       │           ├─ reasoning     → MessageReasoning
       │           ├─ dynamic-tool  → ToolCard (approvals) / QuestionCard (the `question` tool)
       │           ├─ data-agent    → AgentCard → side panel opens the child thread
       │           ├─ data-artifact → inline button → right panel
       │           └─ step-start    → pipeline stages collapse into StepCards; the last stage is the answer
       ├─ TaskBar (memo)  ← latest data-task-list
       └─ Composer (memo) + ThreadUsageRing (self-subscribes to the thread)
  └─ RightPanel (agent = AgentView(useThread(childThreadId)) / artifact / usage / model / agent-details)
```

- **Opening a thread** = `GET /v1/threads/{id}/messages`, fold every message's
  events with `reduce`, then `subscribe{after: cursor}`. A reload mid-answer
  therefore shows the folded partial turn and streams only the tail.
- **Sending** appends an optimistic user message and sends `run`; the backend's
  `TEXT_MESSAGE_*` for the same message id replaces it. `agentId` comes from the
  UI store (`"auto"` → omitted so the backend's default agent routes; `null` →
  the bare-model `chat` agent); `model` is the selected model.
- **Sub-agents** are threads: the parent's `data-agent` card carries
  `childThreadId`, and the side panel renders it with the same `MessageList`.
- **Pipelines**: a message whose `step-start` markers name agents other than
  `metadata.agentId` renders every stage but the last as a collapsible card.

---

## 6. Human-in-the-loop (approvals and questions)

Both pause the run with `RUN_FINISHED{outcome:{type:"interrupt", interrupts}}`
(thread status `awaiting_input`; the composer shows Stop) and continue it with a
`run{resume}` frame. The continuation starts with `RUN_STARTED` for the same
`turnId`, so it folds into the same assistant message.

- **Approval** (`reason: "confirmation"`): the tool part enters
  `approval-requested` with `approval.id` = the interrupt id. `ToolCard` shows
  Approve / Deny and a justification field and calls
  `approve(interruptId, approved, justification)` → `payload: {approved, justification}`.
  The backend echoes the decision as `CUSTOM approval`; a denied call ends as
  `output-denied`.
- **Question** (`reason: "input_required"`, the `question` tool): `QuestionCard`
  reads `part.input.questions` and calls `answer(toolCallId, {answers, text})`
  with `interruptId` = the tool call id. The answers come back as the tool's
  output and the card becomes a read-only recap.

---

## 7. State management

- **Zustand UI store** (`stores/ui-store.ts`): `selectedModel`, `selectedAgentId`,
  `reasoningEffort`, `temporary`, `sidepanel`, `sidebarOpen`, `newChatNonce`.
  Model/agent/effort are **persisted to localStorage**; the rest are ephemeral.
- **Zustand chat store** (`lib/chat/store.ts`): `threads[threadId]` for every
  thread opened in this tab (main view and side panel alike) and `connected`.
  Only `useThread` and `ThreadUsageRing` read it.
- **TanStack Query** (`lib/api/*`) for REST: keys `['agents']`, `['models']`
  (cached 5 min) and `['threads']` (polled every 5 s). Deleting a thread
  invalidates `['threads']`.

---

## 8. Thread & chat-stream performance (FPS) — REQUIRED reading before touching the chat UI

The chat thread re-renders once per animation frame while a run streams. Every
careless re-render in that path multiplies across hundreds of frames and tanks
FPS. This spec is the contract for keeping the thread smooth. **If you change
anything under `components/chat/`, conform to this and re-measure with React Scan.**

### The one rule

> During streaming, the ONLY things that should do real render work are the
> **streaming output itself** (the changed text/reasoning part) and the **live
> usage ring**. The header, composer, selectors, task bar, and *settled* message
> cards (reasoning, tool, question, sub-agent) must NOT re-render per frame.

### Why it's hard (the mechanism)

`useThread` (in `ThreadChat`) selects the thread from the chat store, which
publishes once per animation frame, so `ThreadChat` re-renders on **every
published frame** and its whole subtree is in the blast radius. You cannot avoid
`ThreadChat` re-rendering; you make its children **bail** via `memo` + stable
props, and you isolate live data (usage) to the leaf that needs it.

Key store facts (`lib/chat/store.ts`, `lib/chat/reduce.ts`):
- The reducer **shares structure**: a frame replaces only the message and part
  it touched. Settled messages and parts keep their object identity, so a `memo`
  on the message or part ref is exact.
- `send`/`approve`/`answer`/`stop` from `useThread` are `useCallback`'d on the
  thread id — safe as deps and memoized-component props.
- Frames are batched with `requestAnimationFrame`; a burst of tokens is one render.

### Architecture (current, keep it this way)

- **`ThreadChat`** re-renders per frame but does ~nothing: header + composer are
  memoized and bail; `MessageList` is the intended re-render.
  - Handlers passed to the composer are `useCallback`'d (`onSubmit`, `onOpenUsage`);
    `stop` is already stable from the hook.
  - **Live usage is decoupled**: `Composer` takes a `contextSlot` ReactNode, not a
    `usage` prop. `ThreadChat` passes a `useMemo`'d `<ThreadUsageRing threadId …/>`.
    The ring self-subscribes to the chat store and re-renders alone for the live
    token count — the composer stays memoized.
- **`Composer`, `ThreadHeader`, `AgentSelector`, `ModelSelector`,
  `ReasoningEffortSelector`, `AttachmentButton`, `TaskBar`** are all `memo`'d.
- **`MessageItem`** is `memo`'d on the message ref: only the message the frame
  touched re-renders. Inside it:
  - `ToolCard`, `QuestionCard`, `AgentCard` → `memo` on the part/data ref (the
    reducer replaces it only on a real event for that call or agent).
  - `MessageReasoning` → primitive `text`/`isStreaming` (default shallow memo).
  - `MessageResponse` (Streamdown) → already memoized on `children`.
  - `TaskBar` → `taskSignature` (task ids + statuses).

### Rules for new code

1. **Never pass a per-frame-changing prop into a memoized shell component.** Live
   values (usage, token counts, anything derived from `messages` each frame) must
   be read by a dedicated leaf that selects from the chat store, not threaded
   through the composer/header.
2. **New message-part renderers must be memoized** on the part itself (its ref is
   stable until the reducer replaces it) or on a cheap signature of its own data —
   never the whole `message`.
3. **Callbacks crossing into memoized components must be `useCallback`'d**;
   element props (`contextSlot`) must be `useMemo`'d. A new closure every render
   defeats the memo.
4. **Tooltips:** use the single root `TooltipProvider` (`components/providers.tsx`).
   Never wrap an individual tooltip in its own `TooltipProvider` (it re-renders a
   provider per instance — see the 304× `TooltipProvider` regression).
5. **Heavy popovers/lists** (e.g. the model list) render only when `open`.
6. **Keep the animation-frame batching** in `lib/chat/store.ts`. Publishing per
   event un-throttles the whole subtree.

### How to diagnose (React Scan)

Use the React Scan overlay + Optimize/Ranked tab. Read it as:
- High **"other time" ≫ render time** → cost is browser work (style/layout/paint)
  or `useEffect`/`useLayoutEffect`, usually from **Radix Popper/Tooltip/Collapsible**
  re-rendering thousands of times. Find which user component drags them.
- A component with **renders ≫ prop/context changes** is memoizable. If a memoized
  component still re-renders, its props aren't stable (a changing object/closure)
  or a comparator is missing.
- Components tagged **"Memoizable"** by React Scan are direct candidates.
- Confirm fixes by **re-measuring the same interaction** and checking the offender
  dropped out of the list. This is a loop: fix → re-measure → next offender.

### Reference

Vercel React best-practices rules that apply here: `rerender-memo`,
`rerender-memo-with-default-value`, `rerender-functional-setstate`,
`rerender-use-ref-transient-values`, `rendering-content-visibility`,
`client-event-listeners`. The thread is the hottest path in the app — bias toward
isolating subscriptions and memoizing leaves over "it's probably fine".

---

## 9. Styling & UI kit

- **Tailwind v4**, configured in `app/globals.css` (no `tailwind.config.js`):
  `@theme` with OKLCH tokens, base color `neutral`, CSS variables on. Custom
  helpers: `.ai-glow`, `.ai-gradient`, `.ai-gradient-strong`.
- **shadcn** (`components.json`): style `radix-nova`, RSC enabled, aliases
  `@/components`, `@/lib`, `@/ui`, `@/hooks`; pulls the `@ai-elements` registry
  (the `components/ai-elements/*` AI SDK building blocks).
- **Theme**: `next-themes`, dark by default, class-based, transitions disabled on
  switch.
- Markdown is rendered with **streamdown** (+ `@streamdown/code|math|mermaid|cjk`,
  syntax highlighting via `shiki`). `@xyflow/react`, `rive`, `motion`,
  `media-chrome` are installed for richer artifact/graph rendering but only
  lightly used so far.

---

## 10. Design docs (`plans/`)

Numbered design notes that explain *why* the architecture is what it is — read
before large changes:

- **00-overview** — scope, stack decisions (one design pass deferred), backend gaps.
- **01-streaming-architecture** — **the core render contract**: `ChatMessage`
  parts, transient vs persistent data parts, keyed-part replacement, multi-agent
  rendering, usage ring.
- **02-backend-changes** — backend TODOs (reasoning deltas, usage tokens,
  task-list, artifacts, upload, auth). Written against the old `agentic`
  backend; verify against `agentlite` before assuming a gap.
- **03-frontend-build** — file map, milestones, env vars, data-fetching conventions.
- **04-wire-protocol-decision** — the decision to have the backend emit a **native
  AI SDK stream** (Option B) rather than a hybrid + proxy adapter. **Superseded**:
  the backend now streams AG-UI over a WebSocket and the browser reduces it (§3–5).
- **05-unified-agent-progress** — proposed (not built) cleanup to collapse
  `agent-delta`/`agent-step`/`agent-progress` into one source.
- **06-auto-router-classifier** — proposed "Auto" agent that classifies and routes
  each turn.
- **agent-ui-redesign** — fixes for deep-research UX (error attribution, dynamic
  task list, card = step log vs side panel = full output).

---

## 11. Conventions & gotchas

- **Direct-to-backend, no proxy.** Don't add an `app/api/chat` route; REST and
  the socket hit Go directly. CORS is handled by the backend (permissive).
- **Keep `lib/chat/reduce.ts` in sync with `agentlite/docs/PLAN.md`.** A new
  AG-UI event or activity type needs a reducer case, a part type in
  `lib/chat/types.ts` and a renderer in `message-list.tsx`.
- **`ai` is types-only.** The backend speaks AG-UI; don't import runtime code
  from `ai` or add `@ai-sdk/react` back.
- **One socket per tab** (`lib/chat/socket.ts`). Open threads through
  `useThread`; never subscribe by hand.
- **Temporary chats** run in place on `/chat` (no route, reset on the new-chat
  nonce) but the backend has no temporary mode, so they are persisted like any
  other thread.
- Next 16: dynamic route params are **async** — `await params` in
  `chat/[threadId]/page.tsx`. Re-read `node_modules/next/dist/docs/` before using
  unfamiliar APIs (see top banner).
- Performance: the §8 contract is binding for anything under `components/chat/`.
