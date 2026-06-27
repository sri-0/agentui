<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — `agentui`

The web frontend for the **`agentic`** Go backend (`~/code/agentic`). A Next.js 16
App Router app that renders a corporate, multi-agent LLM chat: streaming
markdown answers, per-sub-agent activity cards, reasoning, tool calls,
human-in-the-loop approvals, task lists, artifacts, and a live context-usage ring.

- **Stack**: Next.js `16.2.9` (App Router) · React `19.2.4` · Vercel **AI SDK v6**
  (`ai@6`, `@ai-sdk/react@3`) · TanStack Query `5` · Zustand `5` · Tailwind v4 ·
  shadcn (style `radix-nova`) · streamdown (markdown) · `@xyflow/react`, `rive`,
  `motion` (graph/animation, mostly latent).
- **Backend contract**: the browser talks **directly** to the Go backend, which
  emits a **native AI SDK v6 UI Message Stream** when `?format=aisdk` is set.
  There is **no Next.js translation proxy** — `useChat`'s `DefaultChatTransport`
  POSTs straight to Go.

> Read alongside `~/code/agentic/AGENTS.md` (§5 wire protocol, §7 HITL). The
> `data-*` part shapes there are the source of truth for `lib/chat/types.ts`.

---

## 1. Quick start

```bash
pnpm install
cp .env.example .env.local       # set backend URLs (see §3)
pnpm dev                         # http://localhost:3000
pnpm build && pnpm start
pnpm lint
```

Requires the Go backend running (default `:8000` for REST, the streaming URL is
configured separately — see §3). Without it, thread/message queries degrade to
empty lists and the composer can't stream.

---

## 2. App Router structure

```
app/
  layout.tsx              # root: Geist fonts + <Providers> (Query, Theme, Tooltip, react-scan)
  page.tsx                # redirect → /chat
  globals.css             # Tailwind v4 @theme, OKLCH tokens, .ai-gradient/.ai-glow helpers
  (app)/
    layout.tsx            # app shell: SidebarProvider + AppSidebar + SidebarInset
    chat/page.tsx         # <LandingView> — centered composer for new/ephemeral chats
    chat/[threadId]/page.tsx   # <ThreadView> — awaits params (Next 16), renders the chat
```

- Root + `(app)` layouts are **Server Components**; every interactive surface is
  `'use client'`.
- **No `app/api/*` routes** — all network calls go directly to the Go backend.
- Landing flow: typing on `/chat` creates a thread id (`nanoid`) and navigates to
  `/chat/[threadId]`; pending text is carried via `lib/chat/pending.ts`.

```
components/
  providers.tsx               # QueryClientProvider + ThemeProvider + single TooltipProvider
  chat/
    use-agent-chat.ts         # owns the Chat instance (see §5)
    use-interrupt-resolver.ts # HITL resume logic (see §6)
    use-request-body.ts       # builds the request body from store selections
    interrupt-context.ts      # passes the resolver down to ToolCard
    landing-view.tsx, thread-view.tsx (ThreadChat), task-bar.tsx, temporary-toggle.tsx
    composer/                 # composer, model-selector, agent-selector,
                              #   reasoning-effort-selector, thread-usage-ring, attachments
    messages/                 # message-list, tool-card, agent-cards, run-progress,
                              #   message-reasoning, message-actions, message-meta
  right-panel/                # right-panel, agent-view, artifact-view, usage-view, model-view, csv
  sidebar/app-sidebar.tsx     # thread list (grouped Today/Yesterday/7d/30d/Older)
  ai-elements/                # shadcn AI Elements registry (message, reasoning, tool, conversation, …)
  ui/                         # shadcn primitives (radix-nova)

lib/
  chat/  api.ts (chatUrl/resumeUrl) · types.ts (ChatMessage/ChatDataParts) ·
         sse-to-chunks.ts · from-history.ts · pending.ts · usage.ts · artifacts.ts
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
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:8000` | browser REST calls (`lib/api/client.ts`) |
| `NEXT_PUBLIC_AGENTIC_URL` | `http://localhost:8011` | streaming chat + resume (`lib/chat/api.ts`) |
| `BACKEND_URL` | `http://localhost:8000` | reserved for server-side use |

> The streaming URL (`NEXT_PUBLIC_AGENTIC_URL`) is **separate** from the REST URL
> in code, even though both point at the same Go server in practice. `.env.example`
> currently only lists the REST vars — set `NEXT_PUBLIC_AGENTIC_URL` too if your
> backend isn't on `:8011`.

REST endpoints consumed directly (TanStack Query in `lib/api/*`):
`GET /v1/agents`, `GET /v1/models`, `GET|POST|PUT|DELETE /v1/threads[/{id}]`,
`GET /v1/threads/{id}/messages`.

Streaming endpoints (`lib/chat/api.ts`):
- `chatUrl()` → `${AGENTIC_URL}/v1/chat/completions?format=aisdk`
- `resumeUrl()` → `${AGENTIC_URL}/v1/agent/resume?format=aisdk`

---

## 4. The wire contract (`lib/chat/types.ts`)

The chat message type is an AI SDK `UIMessage` parameterized with our metadata
and custom data parts:

```ts
export type ChatMessage = UIMessage<ChatMetadata, ChatDataParts>;
```

Native AI SDK parts (`text`, `reasoning`, `dynamic-tool`) arrive as built-in part
types. **Custom** UI data arrives as `data-*` parts (`part.type === "data-<key>"`):

| `data-*` part | Payload (summary) | Rendered by |
|---|---|---|
| `agent-step` | `{agent, step, status: "started"\|"done", durationMs?}` | `AgentCards` |
| `agent-delta` | `{agent, step, kind: "reasoning"\|"text", delta}` | `AgentCards` / `AgentView` |
| `agent-progress` | `{phase, message, agent?}` | `RunProgress` (run-level) / agent card |
| `tool-interrupt` | `{toolCallId, toolName, prompt, details?, threadId?, resolved?}` | `ToolCard` (HITL) |
| `task-list` | `{tasks: [{id,title,status,priority?,agent?}]}` | `TaskBar` |
| `artifact` | `{id, title, kind: markdown\|code\|html\|json\|csv, content, language?}` | inline button → `ArtifactView` |
| `usage` | `{promptTokens, completionTokens, totalTokens, contextUsed, contextWindow, breakdown?}` | `ThreadUsageRing` / `UsageView` |

**Persistence semantics**: `agent-progress` is transient; `agent-step`,
`agent-delta`, `task-list`, `artifact`, `usage` persist. Parts re-emitted with the
**same `id`** replace the prior value (e.g. live task-list snapshots, artifact
updates). Keep these shapes aligned with the backend's `aisdk` encoder
(`agentic/internal/stream/aisdk`).

---

## 5. Chat architecture

```
useAgentChat (owns the Chat instance, keyed by thread id)
  └─ ThreadChat  (re-renders per throttled chunk; children mostly bail)
       ├─ ThreadHeader (memo)
       ├─ MessageList  ← the intended re-render: streams parts
       │     ├─ text          → MessageResponse (streamdown)
       │     ├─ reasoning      → MessageReasoning
       │     ├─ dynamic-tool   → ToolCard (+ HITL overlay)
       │     ├─ data-agent-*   → AgentCards (per sub-agent)
       │     ├─ data-agent-progress (no agent) → RunProgress
       │     └─ data-artifact  → inline button → right panel
       ├─ TaskBar (memo)  ← from data-task-list
       └─ Composer (memo) + ThreadUsageRing (self-subscribes for live tokens)
  └─ RightPanel (sidepanel: agent / artifact / usage / model views)
```

- **`useAgentChat`** (`components/chat/use-agent-chat.ts`) constructs **one**
  `new Chat<ChatMessage>({ id, messages, transport })` per thread and returns
  `{ ...useChat({ chat, experimental_throttle: 50 }), chat }`. The transport is a
  `DefaultChatTransport` whose `prepareSendMessagesRequest` maps camelCase store
  fields → the snake_case body the Go backend expects:
  `{ messages, agent_id, model, thread_id, use_rag, temporary, reasoning_effort }`.
- Secondary subscribers (usage ring, side-panel agent view) call
  `useChat({ chat })` to read the **same** instance — `useChat` does **not** share
  a `Chat` by id, so the single owner pattern is mandatory.
- **Sub-agent rendering**: `AgentCards` groups `agent-delta`/`agent-step` by agent
  name; a card renders only for agents that streamed their own output (the
  `output_agent`'s text is in the main thread and has no card). Clicking a card
  opens `RightPanel` (`kind: "agent"`), which reconstructs that agent's full
  reasoning + text stream in `AgentView`.
- **Loading history**: `useThreadMessages(threadId)` seeds initial messages via
  `lib/chat/from-history.ts`.

---

## 6. Human-in-the-loop (HITL)

1. During streaming the backend emits a `data-tool-interrupt` part and the tool
   part enters `state === "approval-requested"`. `ToolCard`
   (`components/chat/messages/tool-card.tsx`) shows an amber card with the tool
   params and **Approve / Deny** buttons.
2. Clicking calls `resolveInterrupt(toolCallId, action)` from
   `useInterruptResolver` (provided via `InterruptContext`). It:
   - finds the most recent message with a pending tool call (robust to id reuse),
   - records the decision on the part immediately (instant visual flip),
   - `POST`s `resumeUrl()` with `{ thread_id, action }`,
   - reads the resume SSE via `sseToChunkStream()` (`lib/chat/sse-to-chunks.ts`) +
     `readUIMessageStream()` and merges the continuation back into the message.

Maps to backend `POST /v1/agent/resume` (`agentic/internal/handler/resume.go`).

---

## 7. State management

- **Zustand** (`stores/ui-store.ts`): `selectedModel`, `selectedAgentId`,
  `reasoningEffort`, `temporary`, `sidepanel`, `sidebarOpen`, `newChatNonce`.
  Model/agent/effort are **persisted to localStorage**; the rest are ephemeral.
- **TanStack Query** (`lib/api/*`) for all non-streaming reads: keys `['agents']`,
  `['models']`, `['threads']`, `['thread-messages', id]`. Agents/models cached
  5 min; threads/messages degrade to `[]` on backend error. Thread mutations
  invalidate `['threads']`.
- **Chat state** lives entirely in the AI SDK `Chat`/`useChat` instance — no Redux
  or chat context.

---

## 8. Thread & chat-stream performance (FPS) — REQUIRED reading before touching the chat UI

The chat thread streams tokens at ~20fps (throttled). Every careless re-render in
that path multiplies across hundreds of frames and tanks FPS. This spec is the
contract for keeping the thread smooth. **If you change anything under
`components/chat/`, conform to this and re-measure with React Scan.**

### The one rule

> During streaming, the ONLY things that should do real render work are the
> **streaming output itself** (the changed text/reasoning part) and the **live
> usage ring**. The header, composer, selectors, task bar, and *settled* message
> cards (reasoning, tool, agent-progress, sub-agent) must NOT re-render per token.

### Why it's hard (the mechanism)

`useChat` (in `ThreadChat`) subscribes to the chat's **messages** store via
`useSyncExternalStore`, so it re-renders on **every throttled chunk**. Its whole
subtree is in the blast radius. You cannot avoid `ThreadChat` re-rendering; you
make its children **bail** via `memo` + stable props, and you isolate live data
(usage) to the leaf that needs it.

Key SDK facts (verified against `@ai-sdk/react@3`):
- `useChat` does **not** share a `Chat` by `id` — each call makes a new one.
  `useAgentChat` therefore **owns** one `Chat` instance and returns it (`chat`);
  secondary subscribers use `useChat({ chat })` to read the SAME instance.
- `useChat({ chat })`'s `sendMessage`/`stop`/`chat` are stable refs (bound to the
  instance) — safe as `useCallback`/`useMemo` deps and memoized-component props.
- `experimental_throttle: 50` on `useChat` batches updates to ~20fps. Keep it.

### Architecture (current, keep it this way)

- **`useAgentChat`** owns the `Chat` instance (`new Chat`, keyed by thread id) +
  `experimental_throttle`. Returns `{ ...helpers, chat }`.
- **`ThreadChat`** re-renders per chunk but does ~nothing: header + composer are
  memoized and bail; `MessageList` is the intended re-render (stream output).
  - Handlers passed to the composer are `useCallback`'d (`onSubmit`, `onOpenUsage`);
    `onStop`/`sendMessage` are already stable from the hook.
  - **Live usage is decoupled**: `Composer` takes a `contextSlot` ReactNode, not a
    `usage` prop. `ThreadChat` passes a `useMemo`'d `<ThreadUsageRing chat={chat} …/>`.
    The ring self-subscribes via `useChat({ chat })` and re-renders alone for the
    live token count — the composer stays memoized.
- **`Composer`, `ThreadHeader`, `AgentSelector`, `ModelSelector`,
  `ReasoningEffortSelector`, `AttachmentButton`, `TaskBar`** are all `memo`'d.
- **In-message cards** are `memo`'d with **content-signature comparators** so they
  update on new *events* but not on tokens:
  - `RunProgress` → `runProgressKey` (run-level progress phases).
  - `AgentCards` → `agentCardsKey` (agents seen + lifecycle/duration + progress;
    NOT per-delta — cards show steps/status, not streamed text).
  - `ToolCard` → `part.state` + `toolName` + `output` + `interrupt.resolved`.
  - `MessageReasoning` → primitive `text`/`isStreaming` (default shallow memo).
  - `MessageResponse` (Streamdown) → already memoized on `children`.

### Rules for new code

1. **Never pass a per-token-changing prop into a memoized shell component.** Live
   values (usage, token counts, anything derived from `messages` each chunk) must
   be read by a dedicated leaf that self-subscribes (`useChat({ chat })`), not
   threaded through the composer/header.
2. **New message-part renderers must be memoized** with a comparator keyed on a
   cheap **signature of that part's own data** — never the whole `message`. The
   signature must change when a real event arrives and stay equal across tokens.
   Append-only data parts (unique ids) → count/keys; in-place data parts (stable
   id, e.g. `data-agent-step`, `data-task-list`) → include status/content.
3. **Callbacks crossing into memoized components must be `useCallback`'d**;
   element props (`contextSlot`) must be `useMemo`'d. A new closure every render
   defeats the memo.
4. **Tooltips:** use the single root `TooltipProvider` (`components/providers.tsx`).
   Never wrap an individual tooltip in its own `TooltipProvider` (it re-renders a
   provider per instance — see the 304× `TooltipProvider` regression).
5. **Heavy popovers/lists** (e.g. the model list) render only when `open`.
6. **Keep `experimental_throttle`.** Removing it un-throttles the whole subtree.

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
  task-list, artifacts, upload, auth). Several are now implemented in the `aisdk`
  encoder; verify against `agentic` before assuming a gap.
- **03-frontend-build** — file map, milestones, env vars, data-fetching conventions.
- **04-wire-protocol-decision** — the decision to have the backend emit a **native
  AI SDK stream** (Option B) rather than a hybrid + proxy adapter. This is the
  current architecture.
- **05-unified-agent-progress** — proposed (not built) cleanup to collapse
  `agent-delta`/`agent-step`/`agent-progress` into one source.
- **06-auto-router-classifier** — proposed "Auto" agent that classifies and routes
  each turn.
- **agent-ui-redesign** — fixes for deep-research UX (error attribution, dynamic
  task list, card = step log vs side panel = full output).

---

## 11. Conventions & gotchas

- **Direct-to-backend, no proxy.** Don't add an `app/api/chat` route; the
  transport hits Go directly. Auth/CORS is handled by the backend (permissive).
- **Keep `lib/chat/types.ts` in sync** with the backend `aisdk` encoder. A new
  backend `data-*` event needs a `ChatDataParts` entry and a renderer.
- **camelCase store → snake_case body** happens once, in
  `use-agent-chat.ts`'s `prepareSendMessagesRequest`.
- **`useChat` instance ownership**: only `useAgentChat` may call `new Chat`;
  everyone else passes `{ chat }`.
- **Temporary chats** (`temporary: true`) are never persisted server-side and
  reset on a new-chat nonce.
- Next 16: dynamic route params are **async** — `await params` in
  `chat/[threadId]/page.tsx`. Re-read `node_modules/next/dist/docs/` before using
  unfamiliar APIs (see top banner).
- Performance: the §8 contract is binding for anything under `components/chat/`.
