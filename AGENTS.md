<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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

> Read alongside `~/code/agentlite/docs/`: `ARCHITECTURE.md` (the socket
> frames), `HITL.md` (approvals, questions, sub-agent requests) and
> `AG-UI-RENDERING.md` (every event, what `lib/chat/reduce.ts` makes of it and
> which component renders it). Those documents are the source of truth for the
> wire contract.

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
    chat/page.tsx         # <LandingView> — centered composer for a new chat (Chat mode)
    chat/[threadId]/page.tsx   # <ThreadView> — awaits params (Next 16), renders the chat
    artifacts/page.tsx    # <ArtifactsView> — every conversation's artifacts as cards (GET /v1/artifacts)
    images/page.tsx       # <LandingView mode="images"> — the same page in Images mode
    skills/page.tsx       # <SkillsView> — the skills library: categories, sources, cards (/v1/skills)
```

- Root + `(app)` layouts are **Server Components**; every interactive surface is
  `'use client'`.
- **No `app/api/*` routes** — all network calls go directly to the Go backend.
- Landing flow: the first message on `/chat` is `POST /v1/agent/chat`
  (`useStartChat` in `landing-view.tsx`, `createThread` in `lib/api/threads.ts`); the
  server creates the thread, starts the run and replies `201 {threadId, runId, seq}`
  once the thread is stored. The page navigates to `/chat/[threadId]`, which opens it,
  subscribes and replays the turn from its start. Every later turn is a `run` frame on
  the socket. `/images` is the same page in Images mode and starts the thread with
  `agentId: "images"`. The Chat | Images toggle (`mode-toggle.tsx`) is pinned to the top
  of the page and switches between the two; a thread has none (its agent sets its mode).
  The sidebar has no Images item; the toggle is the way in.
- Images conversations: a thread whose `agent_id` is `images` (`IMAGES_AGENT`,
  `lib/api/agents.ts`) is an ordinary chat whose composer is in its images mode
  (`<Composer images>`: `ModelSelector use="image"`, no agent or connector selectors), and
  its turns keep `agentId: "images"` and send no `model`, so the agent runs on the server's
  default LLM (`runOptions(IMAGES_AGENT)`). Every turn sends `imageModel`, the picked image
  model (`selectedImageModel`, persisted), which `generate_image` uses; `ImageCall` shows
  the image in the thread, and a follow-up such as "make it blue" edits it.

```
components/
  providers.tsx               # QueryClientProvider + ThemeProvider + single TooltipProvider
  chat/
    use-thread.ts             # useThread(threadId): the thread's state + send/approve/answer/stop (see §5)
    reference-chip.tsx        # a reference in a text, in its font: the composer's chips and the sent message's
    landing-view.tsx          # the new-conversation page, /chat or /images: one composer whose
                              #   mode the toggle sets, suggestions or the image carousel; useStartChat
    mode-toggle.tsx           # the Chat | Images toggle (shadcn Tabs) in the new-conversation
                              #   page's top bar: switches /chat and /images
    thread-view.tsx (ThreadChat), task-bar.tsx
    composer/                 # composer, model-selector, agent-selector, connector-selector,
                              #   connector-icon, thread-usage-ring, references (the text, with / and @ chips),
                              #   voice (the voice prompt: the mic button and the dictation bar)
    messages/                 # message-list (+ pipeline stage cards), tool-line, question-card
                              #   (QuestionPanel: shadcn questionnaire; QuestionCard: the line or
                              #   recap in the thread), agent-card, markdown (+ source-citation:
                              #   AI Elements inline citation), compaction-divider,
                              #   message-reasoning, message-actions, message-meta,
                              #   skill (SkillLoaded, UserText: the /name chip)
      tools/                  # tool renderers: registry.ts (name → component), slides-call,
                              #   image-call (generate_image: a placeholder, then the image)
  right-panel/                # right-panel, agent-view (child thread), artifact-view (+ list),
                              #   sources-view, usage-view, model-view, agent-details-view,
                              #   connector-details-view
  library/                    # the Spaces-style frame both pages share: LibraryPage (top bar,
                              #   optional nav column), LibraryToolbar (title, search, actions,
                              #   grid/list toggle), LibraryItems/LibraryItem (card or row),
                              #   NavSection/NavItem; creatable-combobox (pick or create a value)
  common/copy-button.tsx      # a copy-to-clipboard icon button for any page
  artifacts/artifacts-view.tsx  # every artifact as a card with a preview of its body (fetched
                              #   once the card is in view), kind tabs, search; ?open=root/id
                              #   opens one full-page; an image card shows the image
  images/recent-images.tsx    # Images mode's scrolling carousel of the latest images (embla auto-scroll),
                              #   each opening its conversation
  skills/skills-view.tsx      # categories and sources (with counts) on the left, search, Create
                              #   (with an agent: /chat?prompt=…; or upload), cards; ?skill=name
                              #   opens one full-page: details, npx command, files
  skills/skill-dialogs.tsx    # upload (a shadcn file input + details) and edit details
  sidebar/app-sidebar.tsx     # thread list (grouped Today/Yesterday/7d/30d/Older) + run-status dots
  sidebar/workspace-groups.tsx # workspaces: a folder of conversations each, new chat in one, rename, delete
  sidebar/thread-row.tsx      # one conversation row: status dot, delete on hover
  chat/workspace-bar.tsx      # the card under the composer: the conversation's workspace, or the next one's
  ai-elements/                # shadcn AI Elements registry (message, reasoning, tool, conversation, …)
  ui/                         # shadcn primitives (radix-nova)

lib/
  chat/  socket.ts (WebSocket) · reduce.ts (AG-UI events → view model) · store.ts (zustand threads) ·
         types.ts (ChatMessage/parts) · usage.ts · artifacts.ts · tasks.ts ·
         thread-context.ts (the thread a view shows, for citations)
  api/   client.ts (apiFetch, apiText) · agents.ts · models.ts · threads.ts · connectors.ts ·
         artifacts.ts · sources.ts · types.ts · voice.ts (transcribe a recording)
  audio/ wav.ts (a recording → 16 kHz mono WAV)
  providers.ts · group-threads.ts · dayjs.ts · utils.ts
stores/ ui-store.ts            # Zustand UI state
hooks/  use-mobile.ts          # shadcn's sidebar breakpoint hook
plans/  00–06 + agent-ui-redesign.md   # design docs (see §9)
```

---

## 3. Environment & endpoints

| Var | Default | Used by |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | REST (`lib/api/client.ts`) and the WebSocket (`lib/chat/socket.ts`, `http` → `ws`) |

WebSocket `GET /v1/agent/chat?v=1` (`lib/chat/socket.ts`), one per tab and shared
by every thread, carries everything between the UI and its agents on existing
threads. The server checks the user can read a thread on the first frame about
it (normally the subscribe) and answers `not_found` if not; the socket then
drops that subscription instead of retrying it on reconnect.
- requests (`chatSocket.request`, answered by `ack {threadId, runId, seq}` or
  `error {code, message}` with the same `requestId`): `run {threadId, agentId?,
  model?, connectors?, messages}`, `answer {threadId, interruptId, approved?,
  justification?, output?}`, `cancel {threadId}`;
- following: `subscribe {threadId, after?}`, `unsubscribe {threadId}`; the server
  streams `event {threadId, seq, event}` and `idle {threadId}`; a subscription ends
  at the segment's `RUN_FINISHED`/`RUN_ERROR`.

REST (TanStack Query / `apiFetch` in `lib/api/*`) is for creating a thread and
for reads and admin:
- `POST /v1/agent/chat` → `201 {threadId, runId, seq}`: a new thread with its first turn,
  filed under `workspaceId` when the composer's workspace card names one
- `GET /v1/agents`, `GET /v1/models`, `GET /v1/connectors`, `GET /v1/connectors/{id}`
- `GET /v1/threads` → `{data: [{id, root_id, title, agent_id, model, connectors?, workspace_id?, created_at, updated_at, run_status?}]}`;
  fetched once, refetched when a run this tab watches starts or ends and on window focus (no polling)
- `GET /v1/threads/{id}` (its `connectors` set the composer's toggles; `['thread', id]`), `PATCH`
  (`{workspace_id}` files it, `""` takes it out), `DELETE`
- `GET /v1/workspaces` (by name), `POST {name}`, `PATCH /v1/workspaces/{id} {name}`,
  `DELETE /v1/workspaces/{id}` (its conversations stay, outside any workspace)
- `GET /v1/threads/{id}/artifacts` (the conversation's artifacts, no bodies) and
  `GET /v1/threads/{id}/artifacts/{artifactId}/content` (one body); refetched when a run ends
- `GET /v1/artifacts?kind=&after=&limit=` → `{data: [artifact + root_id, thread_id, thread_title], next?}`:
  every conversation's artifacts (of one kind, when set) for `/artifacts` and the Images page's
  carousel (`kind=image`), newest first; `next` is the cursor for `after`. Image models come
  from `useModels("image")`
- `POST /v1/voice/transcriptions` (multipart `file`, a 16 kHz mono WAV made by `lib/audio/wav.ts`)
  → `{text}`: the voice prompt; the text is appended to the composer and sent as typed
- `GET /v1/skills?q=&category=&source=` → `{data: [{name, title?, description, category?,
  source?, files: [{path}], created_at, updated_at}], categories, sources}` (`[{value, count}]`):
  the skills library, for `/skills`, the composer's `/` palette and the `/name` chip;
  `POST /v1/skills` as a multipart form (`file`: a skill's zip or its SKILL.md; optional
  `title`, `description`, `category`, `source`), `PATCH /v1/skills/{name}` (JSON details;
  a new description rewrites the SKILL.md), `DELETE /v1/skills/{name}`, and
  `GET /v1/skills/{name}/files/{path}` (one file, as written)
- `GET /v1/threads/{id}/sources` and `GET /v1/threads/{id}/sources/{n}` (what `[source:n]`
  refers to; each citation reads its sources from the list, and one not listed yet is
  fetched when its card opens); the list is refetched when a run ends
- `GET /v1/threads/{id}/messages` → `{data: [{id, thread_id, role, seq, created_at, text, events}], cursor}`;
  `events` are the AG-UI events of that turn, `cursor` is the log id to subscribe from (`""` when idle)

There is no identity header yet and no temporary mode: every thread is persisted.

---

## 4. The view model (`lib/chat/types.ts`, `lib/chat/reduce.ts`)

`reduce(thread, event)` is a pure function over `@ag-ui/core` events producing
`ThreadState = {messages, status, error?, loaded}`. Messages are our own part
shapes (`lib/chat/types.ts`); nothing depends on the AI SDK. A `TOOL_CALL_START` for a
call the last message already holds is ignored, so a replay that overlaps the thread (a
resubscribe, a hot reload) cannot show the call twice. Part types: `text`,
`reasoning`, `tool` (state `running | done | error | approval | denied`), `step-start`,
and `data-agent | data-task-list | data-artifact | data-compaction | data-model | data-skill`. An interrupt is stamped onto the
tool part it holds (`state: "approval"`, `approval.id` = the interrupt id), for an
approval and a `question` alike. The full event → part → component table is
`agentlite/docs/AG-UI-RENDERING.md`.

Per-message `metadata`: `{agentId, model, createdAt, durationMs, usage:{inputTokens, outputTokens}, cancelled?, error?}`.
Data part payloads: `data-agent` is the backend's agent activity
(`subagentRunId, childThreadId, name, description?, status: running | waiting | done | error, startedAt, durationMs?, error?, progress?, log?, text?, interrupts?`; `interrupts` are the child's pending AG-UI interrupts while `waiting`).
When a run ends, cards still `running` or `waiting` are settled as `error`.
`data-task-list` is `{tasks:[{id, title, status}]}`, `data-artifact` is `{id, title, kind, version, language?, url?}`
with kind `markdown | code | json | csv | url | image` (no body: `ArtifactView` fetches it; kind `url` embeds the
page; kind `image` is shown from its content URL, `artifactUrl`, and in the chat by its `generate_image` call
rather than the button; old threads carry `content`). `data-compaction` is `{status: running | completed | failed | declined,
summary?, inputTokens?, outputTokens?, durationMs?, error?}`, one per compaction of the model's context.
`data-model` is `{from, to}`: the turn ran on another model than the thread's previous turn.
`data-skill` is `{name, description}`: the skill a message starting with `/name` loaded; the
server loads it, the message is stored as typed.
When a run ends, text parts still open are marked done.
A `tool` part carries `ui` when the backend names a renderer for the tool (agentlite TOOLS.md).

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
                     published once per animation frame; runs, answers and cancels are socket requests
use-thread.ts        useThread(threadId) → {messages, status, loaded, error, send, approve, answer, stop};
                     opens the thread on mount, unsubscribes (and marks it unloaded) on unmount
  └─ ThreadChat  (re-renders once per published frame; children mostly bail)
       ├─ ThreadHeader (memo)
       ├─ MessageList  ← the intended re-render
       │     └─ MessageItem (memo on the message ref — the reducer shares untouched messages)
       │           ├─ text          → Markdown (streamdown; a run of [source:N] → SourceCitation, the
       │           │                  AI Elements inline citation: a badge with the first source's
       │           │                  host or system and "+N", a hover card to page through them).
       │           │                  `streaming` while the part is open, static once done (see §8)
       │           ├─ reasoning     → MessageReasoning
       │           ├─ tool          → the renderer `toolRenderers[part.ui]` names (SlidesCall), else
       │           │                  ToolLine (one line; approvals open it) / QuestionCard (`question`:
       │           │                  "N questions are waiting" with Answer while open, then a recap)
       │           ├─ data-agent    → AgentCard → side panel opens the child thread
       │           ├─ data-artifact → inline button → the artifact in the right panel
       │           ├─ data-compaction → CompactionDivider: a rule where the context was compacted
       │           │                  and a `compact_context` line holding the summary
       │           ├─ data-model    → ModelChangeDivider: a rule "Changed model to X" (both rules are
       │           │                  ThreadRule); not counted as output for the thinking indicator
       │           ├─ data-skill    → SkillLoaded: a line "Loaded skill X"; not counted as output either
       │           └─ step-start    → consecutive steps by one agent form a stage; in a pipeline every
       │                              stage but the last collapses into a StageCard
       ├─ TaskBar (memo)  ← latest data-task-list
       └─ Composer (memo) + ThreadUsageRing (self-subscribes to the thread), or QuestionPanel
          while a question waits and has not been put away
  └─ RightPanel (agent = AgentView(useThread(childThreadId)) / artifacts / artifact / sources /
                 usage / model / agent-details / connector)
```

- **Opening a thread** = `GET /v1/threads/{id}/messages`, fold every message's
  events with `reduce`, then `subscribe{after: cursor}`. A reload mid-answer
  therefore shows the folded partial turn and streams only the tail. Leaving a
  thread view closes its side panel.
- **Sending** appends an optimistic user message, sends a `run` frame and
  subscribes from the ack's cursor; the backend's `TEXT_MESSAGE_*` for the
  same message id replaces the optimistic copy. `agentId` comes from the UI store
  (`"auto"` → omitted so the backend's default `assistant` answers; `null` → the
  bare-model `chat` agent); `model` and `connectors` are the selected ones.
- **Artifacts and sources** are the conversation's, fetched from the API and merged with
  what the live stream announced (`useArtifacts`). The header shows Artifacts and Sources
  buttons with counts; a new artifact opens the panel during a run. A `url` artifact (a
  slide deck) is embedded in an iframe; the panel's refresh button, or a tool renderer
  (`refreshArtifact`), reloads it. Citations render as chips; the sources panel lists cited
  sources and, on request, everything tools returned.
- **Sub-agents** are threads: the parent's `data-agent` card carries
  `childThreadId`, and the side panel renders it with the same `MessageList`.

---

## 6. Human-in-the-loop (approvals and questions)

Both pause the run with `RUN_FINISHED{outcome:{type:"interrupt", interrupts}}`
(thread status `awaiting_input`). A message sent while the run waits cancels it first
(`stop` resolves once the server has), so the thread never refuses it as busy; the
composer says so in its placeholder. The reducer stamps
each interrupt onto its tool part (`state: "approval"`, `approval.id` = the
interrupt id). The answer is an `answer` frame on that thread;
the continuation starts with `RUN_STARTED` for the same `turnId`, so it folds
into the same assistant message. A run that ends without that answer (a cancel)
leaves the part `denied`.

- **Approval**: `ToolLine` opens, shows the arguments, a justification field and
  Approve / Deny, and calls `approve(interruptId, approved, justification)`. The
  backend echoes the decision as `CUSTOM approval`.
- **Question** (the `question` tool): the part carries `request: {toolName:
  "question", args}`. `QuestionPanel` takes the composer's place: shadcn's
  `questionnaire` (one question at a time, "Question 1 of 2", number keys pick an
  option, a "Something else" box, Previous / Skip / Next / Submit) and calls
  `answer(interruptId, {answers, skipped?})`: one list per question, empty for one
  skipped, `skipped` when all were. Skip all answers that at once; the ✕ puts the
  panel away unanswered, and the thread's "questions are waiting" line has Answer to
  bring it back.
- **A sub-agent's request** shows on its `AgentCard` in the parent thread (status
  "Needs you", the card's `interrupts`), with the same `ToolLine` or `QuestionPanel`
  controls, built by `interruptPart` in the reducer. The answer (`answerSubagent`)
  is an `answer` frame on the child's thread; the controls stay disabled while it
  is in flight and a refusal shows under them. The child resumes and the card
  follows it. The parent never pauses.
  The answers come back as the tool's output and the card becomes a read-only recap.

---

## 7. State management

- **Zustand UI store** (`stores/ui-store.ts`): `selectedModel`, `selectedAgentId`,
  `selectedConnectors` (null = all), `sidepanel`, `libraryView` (grid or list on the
  artifacts and skills pages), `newChatWorkspaceId` (the workspace the next new
  conversation is filed under). Model, agent and view are **persisted to
  localStorage**; the rest are ephemeral. "New chat" clears the panel and the connectors,
  and files the chat under the workspace it was started from (none from the header).
- **Zustand chat store** (`lib/chat/store.ts`): `threads[threadId]` for every
  thread opened in this tab (main view and side panel alike) and `connected`.
  Only `useThread` and `ThreadUsageRing` read it.
- **TanStack Query** (`lib/api/*`) for REST: keys `['agents']`, `['models']`,
  `['connectors']` (cached 5 min), `['skills', filter]` (every filter refetched after an
  upload, an edit or a delete; the previous result stays while the next loads) and `['threads']` (refetched on run status changes, window focus and a new conversation);
  `['workspaces']`, and one thread as stored, `['thread', id]` (the workspace card's; moving a
  thread sets it and refetches `['threads']`). A skill's file
  is `['skill-file', name, updated_at, path]`. Deleting a thread invalidates `['threads']` and
  `['recent-artifacts']`. Per conversation: `['artifacts', id]`, `['sources', id]`
  (one list; chips `select` their own source), `['sources', id, n]` (one source not
  listed yet), `['artifact-body', id, artifactId, version]`; across
  conversations `['recent-artifacts']` (infinite). A run's end invalidates the
  conversation's artifacts and sources and `['recent-artifacts']`.

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
  `ReasoningEffortSelector`, `AttachmentButton`, `TaskBar`, `WorkspaceBar`** are all `memo`'d
  (`WorkspaceBar` takes only the thread id and subscribes to the rest itself).
- **`MessageItem`** is `memo`'d on the message ref: only the message the frame
  touched re-renders. Inside it:
  - `ToolCard`, `QuestionCard`, `AgentCard` → `memo` on the part/data ref (the
    reducer replaces it only on a real event for that call or agent).
  - `MessageReasoning` → primitive `text`/`isStreaming` (default shallow memo).
  - `MessageResponse` (Streamdown) → already memoized on `children` and
    `isAnimating`. Streamdown's streaming mode applies each update in a
    transition, which can leave the last one uncommitted; `Markdown` therefore
    switches to static mode when its part is done (`streaming={!part.done}`),
    and complete text elsewhere (reasoning once done, artifacts, model notes)
    is rendered static. The switch remounts the rendered markdown once at the
    end of each part (static mode renders one tree, streaming one per block):
    code blocks re-highlight and an open citation popover closes. That is the
    price of never showing a stale answer.
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
  switch. An embedded `url` artifact (`EmbeddedPage`) loads with `?theme=<resolved>`
  and is sent each change as `postMessage({type: "open-slide:theme", theme})`
  (open-slide-mcp's embed contract), so it follows the app without reloading.
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
- **The voice prompt** (`composer/voice.tsx`): the mic button turns the composer's footer
  into a dictation bar, as in ChatGPT: X drops the recording, stop transcribes it into the
  text, send transcribes and sends. The waveform is ElevenLabs UI's `live-waveform` (shadcn
  registry, `components/ui/live-waveform.tsx`); it opens the microphone, and a `MediaRecorder`
  records its stream. The server transcribes whole recordings, so no text shows while
  speaking. The recording goes to the server as WAV (`lib/audio/wav.ts`; browsers record
  WebM, which Voxtral refuses), and the text is appended through the editor `ComposerInput`
  hands both `ReferenceInput` and the bar (`editorRef`); send commits it (`flushSync`) before
  submitting the form. Errors show beside the mic button.
- **References are chips in the text** (`composer/references.tsx`): the composer's text is a
  Tiptap editor whose Mention nodes are the chips (`chat/reference-chip.tsx`: the text's font,
  the list's coloured icon), with one list (shadcn's Command in a popover, stock styling, an
  icon per row) for every sigil in its `KINDS` table. `/` lists
  the skills a message can load; the chip reads as `/name` in the text sent, wherever it
  sits, which the backend resolves (`agentlite/internal/refs`: `/` is the only sigil so far,
  `@agent` and `#id` are planned, there is no `$`). `@` lists the agents; since `@agent` is
  not resolved yet, picking one sets the thread's agent as the selector does and the chip
  stays out of the text. Backspace after a chip takes it. Add kinds to the table and their
  choices to `useChoices`, not another menu.
- **`components/ui/` is shadcn registry output only** (style `radix-nova`, as the CLI writes
  it) and `components/ai-elements/` the AI Elements registry. Hand-written shared pieces go
  in `components/common/` or `components/library/`, never in `ui/`.
- Next 16: dynamic route params are **async** — `await params` in
  `chat/[threadId]/page.tsx`. Re-read `node_modules/next/dist/docs/` before using
  unfamiliar APIs (see top banner).
- Performance: the §8 contract is binding for anything under `components/chat/`.
