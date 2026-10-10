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
    chat/page.tsx         # <LandingView> — centered composer for a new chat
    chat/[threadId]/page.tsx   # <ThreadView> — awaits params (Next 16), renders the chat
```

- Root + `(app)` layouts are **Server Components**; every interactive surface is
  `'use client'`.
- **No `app/api/*` routes** — all network calls go directly to the Go backend.
- Landing flow: the first message on `/chat` starts the run (`POST /v1/agent/chat`
  without a thread id); the server creates the thread and the page navigates to
  `/chat/[threadId]`, which opens it and replays the turn from its start.

```
components/
  providers.tsx               # QueryClientProvider + ThemeProvider + single TooltipProvider
  chat/
    use-thread.ts             # useThread(threadId): the thread's state + send/approve/answer/stop (see §5)
    landing-view.tsx, thread-view.tsx (ThreadChat), task-bar.tsx
    composer/                 # composer, model-selector, agent-selector, connector-selector,
                              #   connector-icon, thread-usage-ring
    messages/                 # message-list (+ pipeline stage cards), tool-line, question-card,
                              #   agent-card, message-reasoning, message-actions, message-meta
  right-panel/                # right-panel, agent-view (child thread), artifact-view, usage-view,
                              #   model-view, agent-details-view, connector-details-view
  sidebar/app-sidebar.tsx     # thread list (grouped Today/Yesterday/7d/30d/Older) + run-status dots
  ai-elements/                # shadcn AI Elements registry (message, reasoning, tool, conversation, …)
  ui/                         # shadcn primitives (radix-nova)

lib/
  chat/  socket.ts (WebSocket) · reduce.ts (AG-UI events → view model) · store.ts (zustand threads) ·
         types.ts (ChatMessage/parts) · usage.ts · artifacts.ts · tasks.ts
  api/   client.ts (apiFetch) · agents.ts · models.ts · threads.ts · connectors.ts · types.ts
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
- `GET /v1/agents`, `GET /v1/models`, `GET /v1/connectors`, `GET /v1/connectors/{id}`
- `GET /v1/threads` → `{data: [{id, root_id, title, agent_id, model, connectors?, created_at, updated_at, run_status?}]}`;
  fetched once, refetched when a run this tab watches starts or ends and on window focus (no polling)
- `GET /v1/threads/{id}` (its `connectors` set the composer's toggles), `PATCH`, `DELETE`
- `GET /v1/threads/{id}/messages` → `{data: [{id, thread_id, role, seq, created_at, text, events}], cursor}`;
  `events` are the AG-UI events of that turn, `cursor` is the log id to subscribe from (`""` when idle)
- `POST /v1/agent/chat` `{model, messages:[{id, role:"user", content}], thread_id?, agent_id?, connectors?}` →
  `{id, thread_id, agent_id, model, status, cursor}`; without `thread_id` the server creates the thread
- `POST /v1/threads/{id}/interrupts/{interruptId}` `{approved, justification?}` or `{output}` → `{run_id, cursor}`
- `POST /v1/threads/{id}/cancel`

WebSocket `GET /v1/agent/chat?v=1` (`lib/chat/socket.ts`), one per tab, streaming only:
- client → server: `subscribe{threadId, after?}`, `unsubscribe{threadId}`
- server → client: `event{threadId, seq, event}`, `idle{threadId}` (no active run),
  `error{threadId, code, message}`
- a subscription ends at the segment's `RUN_FINISHED`/`RUN_ERROR`; a new
  `subscribe` for the same thread replaces the old one.

There is no identity header and no temporary mode: every thread is persisted.

---

## 4. The view model (`lib/chat/types.ts`, `lib/chat/reduce.ts`)

`reduce(thread, event)` is a pure function over `@ag-ui/core` events producing
`ThreadState = {messages, status, error?, loaded}`. Messages are our own part
shapes (`lib/chat/types.ts`); nothing depends on the AI SDK. Part types: `text`,
`reasoning`, `tool` (state `running | done | error | approval | denied`), `step-start`,
and `data-agent | data-task-list | data-artifact`. An interrupt is stamped onto the
tool part it holds (`state: "approval"`, `approval.id` = the interrupt id), for an
approval and a `question` alike. The full event → part → component table is
`agentlite/docs/AG-UI-RENDERING.md`.

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
lib/chat/socket.ts   one WebSocket; the set of followed threads + their last seq; jittered-backoff
                     reconnect re-subscribes every followed thread from its last seq
lib/chat/store.ts    zustand: threads[threadId] = ThreadState; frames are reduced as they arrive and
                     published once per animation frame; runs, decisions and cancels go over REST
use-thread.ts        useThread(threadId) → {messages, status, loaded, error, send, approve, answer, stop};
                     opens the thread on mount, unsubscribes (and marks it unloaded) on unmount
  └─ ThreadChat  (re-renders once per published frame; children mostly bail)
       ├─ ThreadHeader (memo)
       ├─ MessageList  ← the intended re-render
       │     └─ MessageItem (memo on the message ref — the reducer shares untouched messages)
       │           ├─ text          → MessageResponse (streamdown)
       │           ├─ reasoning     → MessageReasoning
       │           ├─ tool          → ToolLine (one line; approvals open it) / QuestionCard (the `question` tool)
       │           ├─ data-agent    → AgentCard → side panel opens the child thread
       │           ├─ data-artifact → inline button → right panel
       │           └─ step-start    → consecutive steps by one agent form a stage; in a pipeline every
       │                              stage but the last collapses into a StageCard
       ├─ TaskBar (memo)  ← latest data-task-list
       └─ Composer (memo) + ThreadUsageRing (self-subscribes to the thread)
  └─ RightPanel (agent = AgentView(useThread(childThreadId)) / artifact / usage / model / agent-details / connector)
```

- **Opening a thread** = `GET /v1/threads/{id}/messages`, fold every message's
  events with `reduce`, then `subscribe{after: cursor}`. A reload mid-answer
  therefore shows the folded partial turn and streams only the tail. Leaving a
  thread view closes its side panel.
- **Sending** appends an optimistic user message, `POST`s the turn and
  subscribes from the returned cursor; the backend's `TEXT_MESSAGE_*` for the
  same message id replaces the optimistic copy. `agentId` comes from the UI store
  (`"auto"` → omitted so the backend's default `assistant` answers; `null` → the
  bare-model `chat` agent); `model` and `connectors` are the selected ones.
- **Sub-agents** are threads: the parent's `data-agent` card carries
  `childThreadId`, and the side panel renders it with the same `MessageList`.

---

## 6. Human-in-the-loop (approvals and questions)

Both pause the run with `RUN_FINISHED{outcome:{type:"interrupt", interrupts}}`
(thread status `awaiting_input`; the composer shows Stop). The reducer stamps
each interrupt onto its tool part (`state: "approval"`, `approval.id` = the
interrupt id). The decision goes to `POST /v1/threads/{id}/interrupts/{interruptId}`;
the continuation starts with `RUN_STARTED` for the same `turnId`, so it folds
into the same assistant message. A run that ends without that answer (a cancel)
leaves the part `denied`.

- **Approval**: `ToolLine` opens, shows the arguments, a justification field and
  Approve / Deny, and calls `approve(interruptId, approved, justification)`. The
  backend echoes the decision as `CUSTOM approval`.
- **Question** (the `question` tool, or a sub-agent's question forwarded through
  its `task` call): the part carries `request: {toolName: "question", args}`;
  `QuestionCard` renders `request.args.questions` and calls
  `answer(interruptId, {answers, text})`. A forwarded approval shows on the
  `task` line as "<sub-agent> wants to run <tool> <args>" with Approve / Deny.
  The answers come back as the tool's output and the card becomes a read-only recap.

---

## 7. State management

- **Zustand UI store** (`stores/ui-store.ts`): `selectedModel`, `selectedAgentId`,
  `selectedConnectors` (null = all), `sidepanel`. Model and agent are **persisted to
  localStorage**; the rest are ephemeral. "New chat" clears the panel and the connectors.
- **Zustand chat store** (`lib/chat/store.ts`): `threads[threadId]` for every
  thread opened in this tab (main view and side panel alike) and `connected`.
  Only `useThread` and `ThreadUsageRing` read it.
- **TanStack Query** (`lib/api/*`) for REST: keys `['agents']`, `['models']`,
  `['connectors']` (cached 5 min) and `['threads']` (refetched on run status
  changes and window focus). Deleting a thread invalidates `['threads']`.

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
- **Keep `lib/chat/reduce.ts` in sync with `agentlite/docs/AG-UI-RENDERING.md`.** A new
  AG-UI event or activity type needs a reducer case, a part type in
  `lib/chat/types.ts` and a renderer in `message-list.tsx`.
- **No AI SDK in the chat layer.** The view model is our own; only the vendored
  `components/ai-elements` import types from `ai`. Don't add `@ai-sdk/react` back.
- **One socket per tab** (`lib/chat/socket.ts`). Open threads through
  `useThread`; never subscribe by hand.
- Next 16: dynamic route params are **async** — `await params` in
  `chat/[threadId]/page.tsx`. Re-read `node_modules/next/dist/docs/` before using
  unfamiliar APIs (see top banner).
- Performance: the §8 contract is binding for anything under `components/chat/`.
